import {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import useApi from 'sentry/utils/useApi';

import {Preset, PRESET_AGGREGATES, PresetContext} from './presets';

type Props = {
  organization: Organization;
  project: Project;
  className?: string;
  onSelect?(preset: Preset, ctx: PresetContext): void;
  selectedPresetId?: string;
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
          organization={props.organization}
          project={props.project}
          selected={props.selectedPresetId === preset.id}
          onClick={ctx => props.onSelect && props.onSelect(preset, ctx)}
        />
      ))}
    </div>
  );
}

function PresetSidebarItem(props: {
  index: number;
  organization: Organization;
  preset: Preset;
  project: Project;
  onClick?: (ctx: PresetContext) => void;
  selected?: boolean;
}) {
  const theme = useTheme();
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const iconColor = theme.charts.getColorPalette(PRESET_AGGREGATES.length)[props.index];
  return (
    <StyledPresetSidebarItemContainer
      selected={props.selected || false}
      onClick={() => {
        if (loading) {
          return;
        }
        setLoading(true);
        props.preset
          .makeContext(api, props.project, props.organization)
          .then(props.onClick)
          .finally(() => setLoading(false));
      }}
    >
      {loading && (
        <LoadingWrapper>
          <StyledLoadingIndicator hideMessage />
        </LoadingWrapper>
      )}
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

const LoadingWrapper = styled('div')`
  position: absolute;
  background-color: ${p => p.theme.overlayBackgroundAlpha};
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: default;
`;
const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;
const StyledPresetSidebarItemContainer = styled('div')<{selected: boolean}>`
  border: 1px solid transparent;
  position: relative;
  overflow: hidden;
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
  ${p => p.selected && `border-color: ${p.theme.gray200};`}
`;

const Header = styled('h5')`
  margin-left: ${space(1)};
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
