import type { Track } from "../types";

type PlayerPanelProps = {
  track: Track | null;
};

export function PlayerPanel({ track }: PlayerPanelProps) {
  return (
    <section className="panel player-panel">
      <div className="section-head">
        <div>
          <p className="section-kicker">Official Player</p>
          <h2>{track ? track.title : "Select a track"}</h2>
        </div>
        {track ? <span className="player-pill">{track.artist}</span> : null}
      </div>
      {track?.embedUrl ? (
        <iframe
          allow="autoplay"
          className="player-frame"
          src={track.embedUrl}
          title={`SoundCloud embed for ${track.title}`}
        />
      ) : (
        <div className="empty-state">
          Choose a result or analyze a link to load the official SoundCloud embed.
        </div>
      )}
    </section>
  );
}
