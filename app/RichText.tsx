// 챗봇 답변의 링크(https://...)와 **굵은 글씨**를 화면에 예쁘게 보여주는 작은 도우미
import { Fragment, type ReactNode } from "react";

// [글자](주소) 형태 링크, 그냥 주소, **굵게**
const TOKEN = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)\]]+|\*\*[^*]+\*\*)/g;
const MD_LINK = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/;

export function RichText({ text }: { text: string }) {
  const lines = text.replace(/^#{1,6}\s+/gm, "").split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const parts: ReactNode[] = [];
        let last = 0;
        for (const m of line.matchAll(TOKEN)) {
          const idx = m.index ?? 0;
          if (idx > last) parts.push(line.slice(last, idx));
          const tok = m[0];
          const md = tok.match(MD_LINK);
          if (md)
            parts.push(
              <a key={idx} href={md[2]} target="_blank" rel="noopener noreferrer">
                {md[1].replace(/\*\*/g, "")}
              </a>,
            );
          else if (tok.startsWith("**")) {
            const inner = tok.slice(2, -2);
            const innerLink = inner.match(MD_LINK);
            parts.push(
              <strong key={idx}>
                {innerLink ? (
                  <a href={innerLink[2]} target="_blank" rel="noopener noreferrer">
                    {innerLink[1]}
                  </a>
                ) : (
                  inner
                )}
              </strong>,
            );
          }
          else
            parts.push(
              <a key={idx} href={tok} target="_blank" rel="noopener noreferrer">
                {decodeURIComponentSafe(tok)}
              </a>,
            );
          last = idx + tok.length;
        }
        if (last < line.length) parts.push(line.slice(last));
        return (
          <Fragment key={i}>
            {parts}
            {i < lines.length - 1 && "\n"}
          </Fragment>
        );
      })}
    </>
  );
}

function decodeURIComponentSafe(s: string) {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
}
