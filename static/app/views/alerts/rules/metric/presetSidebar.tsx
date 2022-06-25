import styled from '@emotion/styled';

import {IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import {Preset, PRESET_AGGREGATES} from './presets';

type Props = {
  className?: string;
  onSelect?(preset: Preset): void;
};
export default function PresetSidebar(props: Props) {
  return (
    <div className={props.className}>
      <Header>{t('Suggested Alerts')}</Header>
      {PRESET_AGGREGATES.map(preset => (
        <PresetSidebarItem
          key={preset.id}
          title={preset.title}
          description={preset.description}
          onClick={() => props.onSelect && props.onSelect(preset)}
        />
      ))}
    </div>
  );
}

function PresetSidebarItem(props: {
  description: string;
  title: string;
  onClick?: () => void;
}) {
  return (
    <StyledPresetSidebarItemContainer onClick={props.onClick}>
      <IconGraph size="xxl" />
      <div>
        <h1>{props.title}</h1>
        <p>{props.description}</p>
      </div>
    </StyledPresetSidebarItemContainer>
  );
}

const StyledPresetSidebarItemContainer = styled('div')`
  padding: ${space(1)};
  :not(:last-child) {
    margin-bottom: ${space(1)};
  }
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  h1 {
    font-size: ${p => p.theme.fontSizeMedium};
    margin-bottom: ${space(1)};
  }
  p {
    font-size: ${p => p.theme.fontSizeMedium};
    margin-bottom: 0;
  }
  svg {
    margin-right: ${space(1)};
    padding: ${space(1)};
    flex-shrink: 0;
  }
  display: flex;
  flex-direction: row;
  align-items: center;
  cursor: pointer;
  user-select: none;
`;

const Header = styled('h1')`
  font-size: ${p => p.theme.fontSizeLarge};
`;
