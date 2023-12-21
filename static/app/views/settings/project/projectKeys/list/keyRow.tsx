import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ClippedBox from 'sentry/components/clippedBox';
import Confirm from 'sentry/components/confirm';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project, ProjectKey} from 'sentry/types';
import recreateRoute from 'sentry/utils/recreateRoute';
import {LoaderScript} from 'sentry/views/settings/project/projectKeys/list/loaderScript';
import ProjectKeyCredentials from 'sentry/views/settings/project/projectKeys/projectKeyCredentials';

type Props = {
  data: ProjectKey;
  hasWriteAccess: boolean;
  onRemove: (data: ProjectKey) => void;
  onToggle: (isActive: boolean, data: ProjectKey) => void;
  orgId: string;
  project: Project;
  projectId: string;
} & Pick<RouteComponentProps<{}, {}>, 'routes' | 'location' | 'params'>;

function KeyRow({
  data,
  onRemove,
  onToggle,
  hasWriteAccess,
  routes,
  location,
  params,
  project,
}: Props) {
  const handleEnable = () => onToggle(true, data);
  const handleDisable = () => onToggle(false, data);

  const editUrl = recreateRoute(`${data.id}/`, {routes, params, location});
  const platform = project.platform || 'other';
  const isBrowserJavaScript = platform === 'javascript';
  const isJsPlatform = platform.startsWith('javascript');

  return (
    <Panel>
      <PanelHeader hasButtons>
        <Title disabled={!data.isActive}>
          <PanelHeaderLink to={editUrl}>{data.label}</PanelHeaderLink>
          {!data.isActive && (
            <small>
              {' \u2014  '}
              {t('Disabled')}
            </small>
          )}
        </Title>
        <Controls>
          <Button to={editUrl} size="xs">
            {t('Configure')}
          </Button>
          <Confirm
            disabled={!hasWriteAccess}
            onConfirm={data.isActive ? handleDisable : handleEnable}
            confirmText={data.isActive ? t('Disable Key') : t('Enable Key')}
            message={
              data.isActive
                ? t('Are you sure you want to disable this key?')
                : t('Are you sure you want to enable this key?')
            }
          >
            <Button size="xs">{data.isActive ? t('Disable') : t('Enable')}</Button>
          </Confirm>
          <Confirm
            disabled={!hasWriteAccess}
            priority="danger"
            onConfirm={() => onRemove(data)}
            confirmText={t('Remove Key')}
            message={t(
              'Are you sure you want to remove this key? This action is irreversible.'
            )}
          >
            <Button size="xs" icon={<IconDelete />} aria-label={t('Delete')} />
          </Confirm>
        </Controls>
      </PanelHeader>

      <StyledClippedBox
        clipHeight={300}
        defaultClipped={!isJsPlatform}
        btnText={t('Expand')}
      >
        <StyledPanelBody disabled={!data.isActive}>
          <ProjectKeyCredentials
            projectId={`${data.projectId}`}
            data={data}
            showMinidump={!isJsPlatform}
            showUnreal={!isJsPlatform}
            showSecurityEndpoint={!isJsPlatform}
          />

          {isBrowserJavaScript && (
            <LoaderScript
              projectKey={data}
              routes={routes}
              location={location}
              params={params}
            />
          )}
        </StyledPanelBody>
      </StyledClippedBox>
    </Panel>
  );
}

export default KeyRow;

const StyledClippedBox = styled(ClippedBox)`
  padding: 0;
  margin: 0;
  > *:last-child {
    padding-bottom: ${space(3)};
  }
`;

const PanelHeaderLink = styled(Link)`
  color: ${p => p.theme.subText};
`;

const Title = styled('div')<{disabled: boolean}>`
  flex: 1;
  ${p => (p.disabled ? 'opacity: 0.5;' : '')};
  margin-right: ${space(1)};
`;

const Controls = styled('div')`
  display: grid;
  align-items: center;
  gap: ${space(1)};
  grid-auto-flow: column;
`;

const StyledPanelBody = styled(PanelBody)<{disabled: boolean}>`
  ${p => (p.disabled ? 'opacity: 0.5;' : '')};
`;
