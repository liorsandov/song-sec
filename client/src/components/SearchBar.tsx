type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
};

export function SearchBar({ value, onChange, loading }: SearchBarProps) {
  return (
    <section className="hero-card">
      <div className="eyebrow">Search Flow</div>
      <h1>Search tracks or drop in a SoundCloud URL.</h1>
      <p className="hero-copy">
        Official embeds, metadata-first analysis, and a workspace that keeps up
        with what you are auditioning.
      </p>
      <label className="input-shell">
        <span className="input-label">Search Tracks</span>
        <div className="input-row">
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Try artist, title, or mood"
            type="search"
          />
          <span className={`status-dot ${loading ? "is-live" : ""}`}>
            {loading ? "Searching" : "Ready"}
          </span>
        </div>
      </label>
    </section>
  );
}
