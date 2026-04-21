type RecentSearchesProps = {
  items: string[];
  onPick: (query: string) => void;
};

export function RecentSearches({ items, onPick }: RecentSearchesProps) {
  return (
    <section className="panel panel-compact">
      <div className="section-head">
        <div>
          <p className="section-kicker">Recent Searches</p>
          <h2>Jump back in</h2>
        </div>
      </div>
      {items.length ? (
        <div className="chip-row">
          {items.map((item) => (
            <button className="chip" key={item} onClick={() => onPick(item)} type="button">
              {item}
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-mini">Recent searches appear after your first query.</div>
      )}
    </section>
  );
}
