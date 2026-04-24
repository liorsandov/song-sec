import type { Track } from "../types";

type TrackCardProps = {
  track: Track;
  selected: boolean;
  favorite: boolean;
  onSelect: (track: Track) => void;
  onToggleFavorite: (track: Track) => void;
};

export function TrackCard({
  track,
  selected,
  favorite,
  onSelect,
  onToggleFavorite
}: TrackCardProps) {
  return (
    <article className={`track-card glass-panel ${selected ? "is-selected" : ""}`}>
      <button className="track-main" onClick={() => onSelect(track)} type="button">
        <img
          alt={`${track.title} artwork`}
          className="track-art"
          src={track.artworkUrl ?? "https://placehold.co/400x400/1b1b22/f1ede4?text=SC"}
        />
        <div className="track-meta">
          <div className="track-topline">
            <span className={`quality quality-${track.qualityHint}`}>
              {track.qualityHint}
            </span>
            <span className="track-source">{track.source}</span>
          </div>
          <h3>{track.title}</h3>
          <p>{track.artist}</p>
          <div className="track-stats">
            <span>{track.playbackLabel}</span>
            <span>{track.waveformUrl ? "Waveform present" : "Waveform unknown"}</span>
          </div>
        </div>
      </button>
      <button
        aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
        className={`favorite-button ${favorite ? "is-active" : ""}`}
        onClick={() => onToggleFavorite(track)}
        title={favorite ? "Remove from favorites" : "Add to favorites"}
        type="button"
      >
        {favorite ? "★" : "☆"}
      </button>
    </article>
  );
}
