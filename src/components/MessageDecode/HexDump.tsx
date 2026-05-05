import { useMemo } from 'react';

interface HexRow {
  offset:  string;
  left:    string[];
  right:   string[];
  ascii:   string;
}

function buildHexRows(hex: string): HexRow[] {
  const bytes: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }

  const rows: HexRow[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const slice = bytes.slice(i, i + 16);
    const cols  = Array.from({ length: 16 }, (_, j) =>
      j < slice.length ? slice[j].toString(16).padStart(2, '0') : ''
    );
    const ascii = slice
      .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
      .join('')
      .padEnd(16);

    rows.push({
      offset: i.toString(16).padStart(4, '0'),
      left:   cols.slice(0, 8),
      right:  cols.slice(8),
      ascii,
    });
  }
  return rows;
}

interface HexDumpProps {
  hex: string;
}

export function HexDump({ hex }: HexDumpProps) {
  const rows = useMemo(() => buildHexRows(hex), [hex]);

  return (
    <>
      {rows.map((row) => (
        <div key={row.offset} className="hex-row">
          <span className="hex-offset">{row.offset}</span>
          <span className="hex-bytes">
            {row.left.map((b, i) => (
              <span key={i} className={b ? 'hex-byte' : 'hex-empty'}>{b || '  '}</span>
            ))}
            <span className="hex-gap"> </span>
            {row.right.map((b, i) => (
              <span key={i + 8} className={b ? 'hex-byte' : 'hex-empty'}>{b || '  '}</span>
            ))}
          </span>
          <span className="hex-ascii">{row.ascii}</span>
        </div>
      ))}
    </>
  );
}
