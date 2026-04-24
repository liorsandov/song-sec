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
    <section className="glass-panel panel-compact">
      <div className="section-head">
        <div>
          <p className="section-kicker">URL Analyzer</p>
          <h2>Inspect a SoundCloud track</h2>
        </div>
        <button
          className="glass-button action-button"
          disabled={loading || disabled}
          onClick={onSubmit}
          type="button"
        >
          {loading ? "Analyzing" : "Analyze"}
        </button>
      </div>
      <label className="input-shell">
        <span className="input-label">SoundCloud Track URL</span>
        <input
          className="glass-control"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !loading && !disabled) {
              onSubmit();
            }
          }}
          placeholder="https://soundcloud.com/artist/track"
          type="url"
          value={value}
        />
      </label>
    </section>
  );
}
