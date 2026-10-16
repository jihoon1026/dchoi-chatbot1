// 챗봇 답변의 링크(https://...)와 **굵은 글씨**를 화면에 예쁘게 보여주는 작은 도우미
import { Fragment, type ReactNode } from "react";

const TOKEN = /(https?:\/\/[^\s)\]]+|\*\*[^*]+\*\*)/g;

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
          if (tok.startsWith("**")) parts.push(<strong key={idx}>{tok.slice(2, -2)}</strong>);
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
