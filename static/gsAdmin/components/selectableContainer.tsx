import {useState} from 'react';
import styled from '@emotion/styled';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {space} from 'sentry/styles/space';

type SelectableContainerPanelProps = {
  children: React.ReactNode;
  extraActions?: React.ReactNode;
};

export type SelectableContainerPanel = React.ComponentType<SelectableContainerPanelProps>;

type ContentRenderProps = {
  /**
   * May be used to wrap sections in panels
   */
  Panel: SelectableContainerPanel;
  /**
   * May be used to render the section selector
   */
  selector: React.ReactNode;
};

type Section = {
  /**
   * Renders the content of the section. See the ContentRenderProps to
   * understand what each injected Prop is used for.
   */
  content: (props: ContentRenderProps) => React.ReactElement;
  /**
   * Section identifier
   */
  key: string;
  /**
   * The name of the section. Rendered in the dropdown selector
   */
  name: string;
};

type Props = {
  /**
   * Each available section
   */
  sections: Section[];
  /**
   * The default section to show first
   */
  defaultSectionKey?: string;
  /**
   * Text rendered infront of the dropdown button
   */
  dropdownPrefix?: string;
  /**
   * When rendering the injected Panel component in content, this will be used
   * as the panel name
   */
  panelTitle?: string;
};

function SelectableContainer({
  dropdownPrefix,
  sections,
  panelTitle,
  defaultSectionKey,
}: Props) {
  const [sectionKey, setSection] = useState(defaultSectionKey ?? sections[0]?.key ?? '');

  const section = sections.find(s => s.key === sectionKey);

  if (section === undefined) {
    return null;
  }

  const selector = (
    <CompactSelect
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} size="xs" prefix={dropdownPrefix} />
      )}
      value={sectionKey}
      options={sections.map(s => ({value: s.key, label: s.name}))}
      onChange={opt => setSection(opt.value)}
    />
  );

  // Setup a custom Panel component that renders with the selcetor at the top
  // right corner
  function InjectedPanel({children, extraActions}: SelectableContainerPanelProps) {
    return (
      <Panel>
        <PanelHeader hasButtons>
          <div>{panelTitle}</div>
          <Actions>
            {extraActions}
            {selector}
          </Actions>
        </PanelHeader>
        {children}
      </Panel>
    );
  }

  return section.content({selector, Panel: InjectedPanel});
}

const Actions = styled('div')`
  text-transform: initial;
  font-weight: normal;
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

export default SelectableContainer;
