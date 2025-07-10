export function NotifEmptyState() {
  return (
    <div>
      <h4>Select a source from the sidebar to get started</h4>
      <p>
        🚧 Note: This tool is in development! Keep an eye out for internal comms for when
        this is ready for you to use.
      </p>
      <p style={{marginBottom: 0}}>
        <strong>Features coming soon:</strong>
      </p>
      <ul>
        <li>Fields to enter custom rendered template data</li>
        <li>Viewing all registered templates</li>
        <li>Mobile/Desktop email previews</li>
        <li>Integration raw payload previews (e.g. BlockKit, Teams Blocks)</li>
        <li>Custom renderer templates</li>
      </ul>
    </div>
  );
}
