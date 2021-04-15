import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import SelectControl from 'app/components/forms/selectControl';
import Hovercard from 'app/components/hovercard';
import {IconAdd, IconEdit} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';

import {DashboardDetails, DashboardListItem, DashboardState} from './types';

type OptionType = {
  label: string;
  value: DashboardListItem;
};

type Props = {
  organization: Organization;
  dashboards: DashboardListItem[];
  dashboard: null | DashboardDetails;
  onEdit: () => void;
  onCreate: () => void;
  onCancel: () => void;
  onCommit: () => void;
  onDelete: () => void;
  dashboardState: DashboardState;
};

class Controls extends React.Component<Props> {
  render() {
    const {
      dashboardState,
      dashboards,
      dashboard,
      onEdit,
      onCreate,
      onCancel,
      onCommit,
      onDelete,
    } = this.props;

    const cancelButton = (
      <Button
        data-test-id="dashboard-cancel"
        onClick={e => {
          e.preventDefault();
          onCancel();
        }}
      >
        {t('Cancel')}
      </Button>
    );

    if (['edit', 'pending_delete'].includes(dashboardState)) {
      return (
        <ButtonBar gap={1} key="edit-controls">
          {cancelButton}
          <Confirm
            priority="danger"
            message={t('Are you sure you want to delete this dashboard?')}
            onConfirm={onDelete}
          >
            <Button data-test-id="dashboard-delete" priority="danger">
              {t('Delete')}
            </Button>
          </Confirm>
          <Button
            data-test-id="dashboard-commit"
            onClick={e => {
              e.preventDefault();
              onCommit();
            }}
            priority="primary"
          >
            {t('Save and Finish')}
          </Button>
        </ButtonBar>
      );
    }

    if (dashboardState === 'create') {
      return (
        <ButtonBar gap={1} key="create-controls">
          {cancelButton}
          <Button
            data-test-id="dashboard-commit"
            onClick={e => {
              e.preventDefault();
              onCommit();
            }}
            priority="primary"
          >
            {t('Save and Finish')}
          </Button>
        </ButtonBar>
      );
    }

    const dropdownOptions: OptionType[] = dashboards.map(item => {
      return {
        label: item.title,
        value: item,
      };
    });

    let currentOption: OptionType | undefined = undefined;
    if (dashboard) {
      currentOption = {
        label: dashboard.title,
        value: dashboard,
      };
    } else if (dropdownOptions.length) {
      currentOption = dropdownOptions[0];
    }

    return (
      <StyledButtonBar gap={1} key="controls">
        <DashboardSelect>
          <SelectControl
            key="select"
            name="parameter"
            placeholder={t('Select Dashboard')}
            options={dropdownOptions}
            value={currentOption}
            onChange={({value}: {value: DashboardListItem}) => {
              const {organization} = this.props;
              browserHistory.push({
                pathname: `/organizations/${organization.slug}/dashboards/${value.id}/`,
                // TODO(mark) should this retain global selection?
                query: {},
              });
            }}
          />
        </DashboardSelect>
        <DashboardEditFeature>
          {hasFeature => (
            <Button
              data-test-id="dashboard-create"
              onClick={e => {
                e.preventDefault();
                onCreate();
              }}
              icon={<IconAdd size="xs" isCircled />}
              disabled={!hasFeature}
            >
              {t('Create Dashboard')}
            </Button>
          )}
        </DashboardEditFeature>
        <DashboardEditFeature>
          {hasFeature => (
            <Button
              data-test-id="dashboard-edit"
              onClick={e => {
                e.preventDefault();
                onEdit();
              }}
              priority="primary"
              icon={<IconEdit size="xs" />}
              disabled={!hasFeature}
            >
              {t('Edit Dashboard')}
            </Button>
          )}
        </DashboardEditFeature>
      </StyledButtonBar>
    );
  }
}

const DashboardEditFeature = ({
  children,
}: {
  children: (hasFeature: boolean) => React.ReactNode;
}) => {
  const noFeatureMessage = t('Requires dashboard editing.');

  const renderDisabled = p => (
    <Hovercard
      body={
        <FeatureDisabled
          features={p.features}
          hideHelpToggle
          message={noFeatureMessage}
          featureName={noFeatureMessage}
        />
      }
    >
      {p.children(p)}
    </Hovercard>
  );

  return (
    <Feature
      hookName="feature-disabled:dashboards-edit"
      features={['organizations:dashboards-edit']}
      renderDisabled={renderDisabled}
    >
      {({hasFeature}) => children(hasFeature)}
    </Feature>
  );
};

const DashboardSelect = styled('div')`
  min-width: 200px;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledButtonBar = styled(ButtonBar)`
  flex-shrink: 0;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-auto-flow: row;
    grid-row-gap: ${space(1)};
    width: 100%;
  }
`;

export default Controls;
