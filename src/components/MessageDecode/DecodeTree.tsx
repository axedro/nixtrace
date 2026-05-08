import { useState } from 'react';
import clsx from 'clsx';
import type { DecodedField } from '../../types/session.types';

interface NodeProps {
  field: DecodedField;
  depth: number;
}

function DecodeNode({ field, depth }: NodeProps) {
  const [open, setOpen] = useState(depth < 2);
  const indent = depth * 14;

  if (field.type === 'section') {
    return (
      <div className="dt-node" style={{ paddingLeft: indent + 8 }}>
        <div className="dt-section" onClick={() => setOpen((o) => !o)}>
          <span className="dt-chevron">{open ? '▾' : '▸'}</span>
          <span>{field.key}</span>
          {!open && field.children && (
            <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
              &nbsp;({field.children.length})
            </span>
          )}
        </div>
        {open && field.children?.map((child, i) => (
          <DecodeNode key={`${child.key}-${i}`} field={child} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <div className={clsx('dt-node dt-leaf', { 'dt-err': field.error })} style={{ paddingLeft: indent + 8 }}>
      <span className="dt-key">{field.key}:</span>
      <span className="dt-value">{String(field.value)}</span>
      {field.type === 'hex' && (
        <span className="dt-hex">&nbsp;→ {String(field.value).replace(/^0x/, '')} hex</span>
      )}
    </div>
  );
}

interface DecodeTreeProps {
  fields: DecodedField[];
}

export function DecodeTree({ fields }: DecodeTreeProps) {
  if (!fields || !fields.length) {
    return <div className="dt-empty">No decoded fields available</div>;
  }
  return (
    <>
      {fields.map((f, i) => (
        <DecodeNode key={`${f.key}-${i}`} field={f} depth={0} />
      ))}
    </>
  );
}
