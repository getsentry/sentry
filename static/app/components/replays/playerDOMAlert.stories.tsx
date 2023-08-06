import PlayerDOMAlert from 'sentry/components/replays/playerDOMAlert';

export default function Main() {
  return (
    <div style={{position: 'relative'}}>
      <div>
        <b>Dom Alert:</b>
      </div>
      <PlayerDOMAlert />
    </div>
  );
}
