import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

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
      {PRESET_AGGREGATES.map((preset, i) => (
        <PresetSidebarItem
          key={preset.id}
          preset={preset}
          index={i}
          onClick={() => props.onSelect && props.onSelect(preset)}
        />
      ))}
    </div>
  );
}

function PresetSidebarItem(props: {index: number; preset: Preset; onClick?: () => void}) {
  const theme = useTheme();
  const iconColor = theme.charts.getColorPalette(PRESET_AGGREGATES.length)[props.index];
  return (
    <StyledPresetSidebarItemContainer onClick={props.onClick}>
      <IconWrapper backgroundColor={iconColor}>
        {<props.preset.Icon color="white" />}
      </IconWrapper>
      <div>
        <h1>{props.preset.title}</h1>
        <small>{props.preset.description}</small>
      </div>
    </StyledPresetSidebarItemContainer>
  );
}

const StyledPresetSidebarItemContainer = styled('div')`
  border: 1px solid transparent;
  border-radius: ${p => p.theme.borderRadius};
  transition: border-color 0.3s ease;
  padding: ${space(2)};
  h1 {
    font-size: ${p => p.theme.fontSizeLarge};
    font-weight: 500;
    margin-bottom: 0;
    color: ${p => p.theme.gray500};
  }
  small {
    color: ${p => p.theme.gray300};
  }
  display: flex;
  flex-direction: row;
  align-items: start;
  cursor: pointer;
  user-select: none;

  &:hover {
    border-color: ${p => p.theme.gray100};
  }
`;

const Header = styled('h5')`
  margin-left: ${space(2)};
`;

const IconWrapper = styled('div')<{backgroundColor: string}>`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${space(1)};
  min-width: 40px;
  height: 40px;
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.backgroundColor};
  margin-right: ${space(1)};
`;
