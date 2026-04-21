import type { Track } from "../types";

type WorkspacePanelProps = {
  tracks: Track[];
  activeTrackId: string | null;
  onSelect: (track: Track) => void;
};

export function WorkspacePanel({
  tracks,
  activeTrackId,
  onSelect
}: WorkspacePanelProps) {
  return (
    <section className="panel side-panel">
      <div className="section-head">
        <div>
          <p className="section-kicker">Workspace</p>
          <h2>Session tracks</h2>
        </div>
        <span className="counter-pill">{tracks.length}</span>
      </div>
      {tracks.length ? (
        <div className="mini-list">
          {tracks.map((track) => (
            <button
              className={`mini-card ${activeTrackId === track.id ? "is-active" : ""}`}
              key={`${track.id}-${track.source}`}
              onClick={() => onSelect(track)}
              type="button"
            >
              <strong>{track.title}</strong>
              <span>{track.artist}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-mini">Tracks you inspect stay in this workspace.</div>
      )}
    </section>
  );
}
