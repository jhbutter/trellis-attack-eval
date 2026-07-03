type Props = {
  completed: number;
  total: number;
  label?: string;
};

export function ProgressBar({ completed, total, label }: Props) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <div className="progress-block">
      <div className="progress-meta">
        <span>{label || '评测进度'}</span>
        <strong>{completed}/{total} · {percent}%</strong>
      </div>
      <div className="progress-track" aria-label="progress">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
