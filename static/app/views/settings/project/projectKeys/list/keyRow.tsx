import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import ClippedBox from 'sentry/components/clippedBox';
import Confirm from 'sentry/components/confirm';
import Link from 'sentry/components/links/link';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Scope} from 'sentry/types';
import recreateRoute from 'sentry/utils/recreateRoute';
import ProjectKeyCredentials from 'sentry/views/settings/project/projectKeys/projectKeyCredentials';
import {ProjectKey} from 'sentry/views/settings/project/projectKeys/types';

type Props = {
  access: Set<Scope>;
  api: Client;
  data: ProjectKey;
  onRemove: (data: ProjectKey) => void;
  onToggle: (isActive: boolean, data: ProjectKey) => void;
  orgId: string;
  projectId: string;
} & Pick<RouteComponentProps<{}, {}>, 'routes' | 'location' | 'params'>;

function KeyRow({data, onRemove, onToggle, access, routes, location, params}: Props) {
  const handleEnable = () => onToggle(true, data);
  const handleDisable = () => onToggle(false, data);

  const editUrl = recreateRoute(`${data.id}/`, {routes, params, location});
  const controlActive = access.has('project:write');

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
          <Button to={editUrl} size="sm">
            {t('Configure')}
          </Button>
          <Confirm
            onConfirm={data.isActive ? handleDisable : handleEnable}
            confirmText={data.isActive ? t('Disable Key') : t('Enable Key')}
            message={
              data.isActive
                ? t('Are you sure you want to disable this key?')
                : t('Are you sure you want to enable this key?')
            }
          >
            <Button size="sm" disabled={!controlActive}>
              {data.isActive ? t('Disable') : t('Enable')}
            </Button>
          </Confirm>
          <Confirm
            priority="danger"
            onConfirm={() => onRemove(data)}
            confirmText={t('Remove Key')}
            message={t(
              'Are you sure you want to remove this key? This action is irreversible.'
            )}
          >
            <Button
              size="sm"
              disabled={!controlActive}
              icon={<IconDelete />}
              aria-label={t('Delete')}
            />
          </Confirm>
        </Controls>
      </PanelHeader>

      <StyledClippedBox clipHeight={300} defaultClipped btnText={t('Expand')}>
        <StyledPanelBody disabled={!data.isActive}>
          <ProjectKeyCredentials projectId={`${data.projectId}`} data={data} />
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
