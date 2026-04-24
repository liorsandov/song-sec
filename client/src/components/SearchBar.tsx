type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
};

export function SearchBar({ value, onChange, onSubmit, loading }: SearchBarProps) {
  return (
    <section className="glass-panel search-panel">
      <div className="section-head">
        <div>
          <p className="section-kicker">Search Flow</p>
          <h2>Find tracks by artist, title, or mood</h2>
        </div>
        <span className={`state-pill ${loading ? "loading" : "idle"}`}>
          {loading ? "Searching" : "Ready"}
        </span>
      </div>
      <label className="input-shell">
        <span className="input-label">Search Tracks</span>
        <div className="input-row">
          <input
            className="glass-control"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !loading) {
                onSubmit();
              }
            }}
            placeholder="Try artist, title, or mood"
            type="search"
            value={value}
          />
          <button className="glass-button action-button" disabled={loading} onClick={onSubmit} type="button">
            Search
          </button>
        </div>
      </label>
    </section>
  );
}
