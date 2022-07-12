import {Component} from 'react';
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

class KeyRow extends Component<Props> {
  handleRemove = () => {
    const {data, onRemove} = this.props;
    onRemove(data);
  };

  handleEnable = () => {
    const {onToggle, data} = this.props;
    onToggle(true, data);
  };

  handleDisable = () => {
    const {onToggle, data} = this.props;
    onToggle(false, data);
  };

  render() {
    const {access, data, routes, location, params} = this.props;
    const editUrl = recreateRoute(`${data.id}/`, {routes, params, location});
    const controlActive = access.has('project:write');

    const controls = [
      <Button key="edit" to={editUrl} size="sm">
        {t('Configure')}
      </Button>,
      <Button
        key="toggle"
        size="sm"
        onClick={data.isActive ? this.handleDisable : this.handleEnable}
        disabled={!controlActive}
      >
        {data.isActive ? t('Disable') : t('Enable')}
      </Button>,
      <Confirm
        key="remove"
        priority="danger"
        disabled={!controlActive}
        onConfirm={this.handleRemove}
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
      </Confirm>,
    ];

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
            {controls.map((c, n) => (
              <span key={n}> {c}</span>
            ))}
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
