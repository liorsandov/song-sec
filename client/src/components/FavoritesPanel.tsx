import type { Track } from "../types";

type FavoritesPanelProps = {
  tracks: Track[];
  activeTrackId: string | null;
  onSelect: (track: Track) => void;
};

export function FavoritesPanel({
  tracks,
  activeTrackId,
  onSelect
}: FavoritesPanelProps) {
  return (
    <section className="panel side-panel">
      <div className="section-head">
        <div>
          <p className="section-kicker">Favorites</p>
          <h2>Quick access</h2>
        </div>
        <span className="counter-pill">{tracks.length}</span>
      </div>
      {tracks.length ? (
        <div className="mini-list">
          {tracks.map((track) => (
            <button
              className={`mini-card ${activeTrackId === track.id ? "is-active" : ""}`}
              key={track.id}
              onClick={() => onSelect(track)}
              type="button"
            >
              <strong>{track.title}</strong>
              <span>{track.artist}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-mini">Favorited tracks appear here.</div>
      )}
    </section>
  );
}
