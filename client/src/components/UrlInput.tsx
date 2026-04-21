type UrlInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  disabled?: boolean;
};

export function UrlInput({
  value,
  onChange,
  onSubmit,
  loading,
  disabled
}: UrlInputProps) {
  return (
    <section className="panel panel-compact">
      <div className="section-head">
        <div>
          <p className="section-kicker">URL Analyzer</p>
          <h2>Paste a track link</h2>
        </div>
        <button
          className="action-button"
          onClick={onSubmit}
          disabled={loading || disabled}
          type="button"
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </div>
      <label className="input-shell">
        <span className="input-label">SoundCloud Track URL</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://soundcloud.com/artist/track"
          type="url"
        />
      </label>
    </section>
  );
}
