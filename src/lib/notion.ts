import { APIResponseError, Client } from "@notionhq/client";
import type {
  BlockObjectRequest,
  BlockObjectResponse,
  CreatePageParameters,
  DataSourceObjectResponse,
  PageObjectResponse,
  QueryDataSourceResponse,
} from "@notionhq/client/build/src/api-endpoints";

type CompanyEntry = {
  id: string;
  title: string;
  tag: string | null;
  date: string | null;
  summary: string;
  imageUrl: string | null;
};

type NewCompanyEntryInput = {
  title: string;
  tag?: string;
  date?: string;
  summary?: string;
  imageUrl?: string;
};

const PROPERTY_NAMES = {
  title: "이름",
  tag: "태그",
  date: "날짜",
} as const;

function getNotionClient() {
  const notionToken = process.env.NOTION_TOKEN;

  if (!notionToken) {
    throw new Error("Missing NOTION_TOKEN in environment variables.");
  }

  return new Client({ auth: notionToken });
}

function getDatabaseId() {
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!databaseId) {
    throw new Error("Missing NOTION_DATABASE_ID in environment variables.");
  }

  return databaseId;
}

function isFullPageObject(
  page: QueryDataSourceResponse["results"][number],
): page is PageObjectResponse {
  return page.object === "page" && "properties" in page;
}

function isBlockObject(
  block: { object: string; type?: string },
): block is BlockObjectResponse {
  return block.object === "block" && "type" in block;
}

async function resolveDatabaseAndDataSourceId(
  notion: Client,
  idFromEnv: string,
) {
  try {
    const database = await notion.databases.retrieve({
      database_id: idFromEnv,
    });
    const dataSourceId =
      "data_sources" in database ? database.data_sources[0]?.id : undefined;

    if (!dataSourceId) {
      throw new Error("No data source found in this database.");
    }

    return { databaseId: idFromEnv, dataSourceId };
  } catch (error) {
    const pageIdError =
      error instanceof APIResponseError &&
      error.message.includes("is a page, not a database");

    if (!pageIdError) {
      throw error;
    }

    const blockResponse = await notion.blocks.children.list({
      block_id: idFromEnv,
      page_size: 100,
    });
    const blocks = blockResponse.results.filter(isBlockObject);
    const childDatabaseBlock = blocks.find((block) => block.type === "child_database");

    if (!childDatabaseBlock) {
      throw new Error(
        "NOTION_DATABASE_ID is a page ID. No inline database was found in that page. Please set the actual database ID.",
      );
    }

    const database = await notion.databases.retrieve({
      database_id: childDatabaseBlock.id,
    });
    const dataSourceId =
      "data_sources" in database ? database.data_sources[0]?.id : undefined;

    if (!dataSourceId) {
      throw new Error("No data source found in the discovered database.");
    }

    return { databaseId: childDatabaseBlock.id, dataSourceId };
  }
}

function getPlainText(
  richText: Array<{ plain_text: string }> | undefined,
): string {
  if (!richText || richText.length === 0) {
    return "";
  }

  return richText.map((item) => item.plain_text).join("");
}

function extractFirstImageUrl(blocks: BlockObjectResponse[]): string | null {
  for (const block of blocks) {
    if (block.type !== "image") {
      continue;
    }

    const image = block.image;

    if (image.type === "external") {
      return image.external.url;
    }

    if (image.type === "file") {
      return image.file.url;
    }
  }

  return null;
}

function extractSummary(blocks: BlockObjectResponse[]): string {
  const lines: string[] = [];

  for (const block of blocks) {
    let content:
      | Array<{ plain_text: string }>
      | undefined;

    switch (block.type) {
      case "paragraph":
        content = block.paragraph.rich_text;
        break;
      case "heading_1":
        content = block.heading_1.rich_text;
        break;
      case "heading_2":
        content = block.heading_2.rich_text;
        break;
      case "heading_3":
        content = block.heading_3.rich_text;
        break;
      case "bulleted_list_item":
        content = block.bulleted_list_item.rich_text;
        break;
      case "numbered_list_item":
        content = block.numbered_list_item.rich_text;
        break;
      case "quote":
        content = block.quote.rich_text;
        break;
      default:
        content = undefined;
    }

    const text = getPlainText(content).trim();

    if (text) {
      lines.push(text);
    }

    if (lines.length >= 2) {
      break;
    }
  }

  return lines.join(" ");
}

function parsePageProperties(page: PageObjectResponse) {
  const titleProperty = page.properties[PROPERTY_NAMES.title];
  const tagProperty = page.properties[PROPERTY_NAMES.tag];
  const dateProperty = page.properties[PROPERTY_NAMES.date];

  const title =
    titleProperty && titleProperty.type === "title"
      ? getPlainText(titleProperty.title) || "(제목 없음)"
      : "(제목 없음)";

  const tag =
    tagProperty && tagProperty.type === "multi_select"
      ? tagProperty.multi_select[0]?.name ?? null
      : tagProperty && tagProperty.type === "select"
        ? tagProperty.select?.name ?? null
        : null;

  const date =
    dateProperty && dateProperty.type === "date"
      ? dateProperty.date?.start ?? null
      : null;

  return { title, tag, date };
}

export async function getCompanyEntries(): Promise<CompanyEntry[]> {
  const notion = getNotionClient();
  const databaseId = getDatabaseId();
  const { dataSourceId } = await resolveDatabaseAndDataSourceId(
    notion,
    databaseId,
  );

  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    page_size: 20,
    // Some workspaces don't have a "날짜" property.
    // Sorting by created_time keeps queries resilient across schemas.
    sorts: [
      {
        timestamp: "created_time",
        direction: "descending",
      },
    ],
  });

  const pages = response.results.filter(isFullPageObject);

  const entries = await Promise.all(
    pages.map(async (page) => {
      const blockResponse = await notion.blocks.children.list({
        block_id: page.id,
        page_size: 50,
      });

      const blocks = blockResponse.results.filter(isBlockObject);
      const { title, tag, date } = parsePageProperties(page);
      const imageUrl = extractFirstImageUrl(blocks);
      const summary = extractSummary(blocks);

      return {
        id: page.id,
        title,
        tag,
        date,
        summary,
        imageUrl,
      };
    }),
  );

  return entries;
}

export async function createCompanyEntry(input: NewCompanyEntryInput) {
  const notion = getNotionClient();
  const databaseId = getDatabaseId();
  const { dataSourceId } = await resolveDatabaseAndDataSourceId(
    notion,
    databaseId,
  );

  const cleanTitle = input.title.trim();

  if (!cleanTitle) {
    throw new Error("제목은 필수입니다.");
  }

  const properties: NonNullable<CreatePageParameters["properties"]> = {
    [PROPERTY_NAMES.title]: {
      title: [{ text: { content: cleanTitle } }],
    },
  };

  const dataSource = (await notion.dataSources.retrieve({
    data_source_id: dataSourceId,
  })) as DataSourceObjectResponse;
  const tagSchema = dataSource.properties[PROPERTY_NAMES.tag];
  const dateSchema = dataSource.properties[PROPERTY_NAMES.date];

  if (input.tag?.trim()) {
    if (tagSchema?.type === "multi_select") {
      properties[PROPERTY_NAMES.tag] = {
        multi_select: [{ name: input.tag.trim() }],
      };
    }

    if (tagSchema?.type === "select") {
      properties[PROPERTY_NAMES.tag] = {
        select: { name: input.tag.trim() },
      };
    }
  }

  if (input.date?.trim() && dateSchema?.type === "date") {
    properties[PROPERTY_NAMES.date] = {
      date: { start: input.date.trim() },
    };
  }

  const children: BlockObjectRequest[] = [];

  if (input.summary?.trim()) {
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: {
              content: input.summary.trim(),
            },
          },
        ],
      },
    });
  }

  if (input.imageUrl?.trim()) {
    children.push({
      object: "block",
      type: "image",
      image: {
        type: "external",
        external: {
          url: input.imageUrl.trim(),
        },
      },
    });
  }

  await notion.pages.create({
    parent: { data_source_id: dataSourceId },
    properties,
    children,
  });
}
