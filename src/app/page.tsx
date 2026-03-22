import { revalidatePath } from "next/cache";
import { getCompanyEntries, createCompanyEntry } from "@/lib/notion";

export const dynamic = "force-dynamic";

export default async function Home() {
  const entries = await getCompanyEntries();

  async function addEntryAction(formData: FormData) {
    "use server";

    await createCompanyEntry({
      title: String(formData.get("title") ?? ""),
      tag: String(formData.get("tag") ?? ""),
      date: String(formData.get("date") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      imageUrl: String(formData.get("imageUrl") ?? ""),
    });

    revalidatePath("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Notion CMS 샘플</h1>
        <p className="text-sm text-zinc-600">
          1) 노션 DB에서 이미지+텍스트 불러오기, 2) 폼으로 노션 DB에 데이터 추가하기
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">노션 DB에 새 데이터 추가</h2>

        <form action={addEntryAction} className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            제목(이름) *
            <input
              name="title"
              required
              className="rounded-md border border-zinc-300 px-3 py-2"
              placeholder="예: 2026 봄 워크샵"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            태그
            <input
              name="tag"
              className="rounded-md border border-zinc-300 px-3 py-2"
              placeholder="예: 2026"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            날짜
            <input
              type="date"
              name="date"
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            이미지 URL (외부 주소)
            <input
              name="imageUrl"
              className="rounded-md border border-zinc-300 px-3 py-2"
              placeholder="https://..."
            />
          </label>

          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            설명 텍스트
            <textarea
              name="summary"
              rows={3}
              className="rounded-md border border-zinc-300 px-3 py-2"
              placeholder="페이지 본문에 들어갈 짧은 설명"
            />
          </label>

          <button
            type="submit"
            className="w-fit rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
          >
            노션에 추가
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">노션에서 가져온 항목</h2>

        {entries.length === 0 ? (
          <p className="text-sm text-zinc-600">표시할 데이터가 없습니다.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
              >
                {entry.imageUrl ? (
                  <img
                    src={entry.imageUrl}
                    alt={entry.title}
                    className="h-52 w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-52 items-center justify-center bg-zinc-100 text-sm text-zinc-500">
                    이미지 없음
                  </div>
                )}

                <div className="space-y-2 p-4">
                  <h3 className="text-lg font-semibold">{entry.title}</h3>

                  <div className="flex gap-2 text-xs text-zinc-600">
                    {entry.tag ? <span>태그: {entry.tag}</span> : null}
                    {entry.date ? <span>날짜: {entry.date}</span> : null}
                  </div>

                  <p className="text-sm text-zinc-700">
                    {entry.summary || "본문 텍스트가 없습니다."}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
