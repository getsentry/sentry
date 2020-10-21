import {Link} from 'react-router';
import {RouteComponentProps} from 'react-router/lib/Router';
import { Component } from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {ProjectKey} from 'app/views/settings/project/projectKeys/types';
import {t} from 'app/locale';
import Button from 'app/components/button';
import ClippedBox from 'app/components/clippedBox';
import Confirm from 'app/components/confirm';
import {IconDelete} from 'app/icons';
import ProjectKeyCredentials from 'app/views/settings/project/projectKeys/projectKeyCredentials';
import recreateRoute from 'app/utils/recreateRoute';
import space from 'app/styles/space';
import {Scope} from 'app/types';

type Props = {
  api: Client;
  orgId: string;
  projectId: string;
  data: ProjectKey;
  access: Set<Scope>;
  onToggle: (isActive: boolean, data: ProjectKey) => void;
  onRemove: (data: ProjectKey) => void;
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
      <Button key="edit" to={editUrl} size="small">
        {t('Configure')}
      </Button>,
      <Button
        key="toggle"
        size="small"
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
        <Button size="small" disabled={!controlActive} icon={<IconDelete />} />
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
  color: ${p => p.theme.gray600};
`;

const Title = styled('div')<{disabled: boolean}>`
  flex: 1;
  ${p => (p.disabled ? 'opacity: 0.5;' : '')};
  margin-right: ${space(1)};
`;

const Controls = styled('div')`
  display: grid;
  align-items: center;
  grid-gap: ${space(1)};
  grid-auto-flow: column;
`;

const StyledPanelBody = styled(PanelBody)<{disabled: boolean}>`
  ${p => (p.disabled ? 'opacity: 0.5;' : '')};
`;
