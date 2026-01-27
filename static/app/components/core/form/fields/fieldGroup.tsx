import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';

export function FieldGroup({
  title,
  children,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Panel>
      <PanelHeader>{title}</PanelHeader>
      <PanelBody>{children}</PanelBody>
    </Panel>
  );
}
