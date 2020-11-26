import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import SelectControl from 'app/components/forms/selectControl';
import {IconAdd, IconEdit} from 'app/icons';
import {t} from 'app/locale';
import {Organization} from 'app/types';

import {DashboardListItem, DashboardState} from './types';

type OptionType = {
  label: string;
  value: DashboardListItem;
};

type Props = {
  organization: Organization;
  dashboards: DashboardListItem[];
  dashboard: DashboardListItem;
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
        onClick={e => {
          e.preventDefault();
          onCancel();
        }}
        size="small"
      >
        {t('Cancel')}
      </Button>
    );

    if (dashboardState === 'edit') {
      return (
        <ButtonBar gap={1} key="edit-controls">
          {cancelButton}
          <Button
            onClick={e => {
              e.preventDefault();
              onDelete();
            }}
            priority="danger"
            size="small"
          >
            {t('Delete Dashboard')}
          </Button>
          <Button
            onClick={e => {
              e.preventDefault();
              onCommit();
            }}
            priority="primary"
            size="small"
          >
            {t('Finish Editing')}
          </Button>
        </ButtonBar>
      );
    }

    if (dashboardState === 'create') {
      return (
        <ButtonBar gap={1} key="create-controls">
          {cancelButton}
          <Button
            onClick={e => {
              e.preventDefault();
              onCommit();
            }}
            priority="primary"
            size="small"
          >
            {t('Create Dashboard')}
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

    const currentOption: OptionType = {
      label: dashboard.title,
      value: dashboard,
    };

    return (
      <ButtonBar gap={1} key="controls">
        <Button
          onClick={e => {
            e.preventDefault();
            onEdit();
          }}
          icon={<IconEdit size="xs" />}
          size="small"
        >
          {t('Edit')}
        </Button>
        <DashboardSelect>
          <SelectControl
            key="select"
            name="parameter"
            placeholder={t('Select Dashboard')}
            options={dropdownOptions}
            value={currentOption}
            onChange={({value}: {value: DashboardListItem}) => {
              const {organization} = this.props;

              if (value.type === 'prebuilt') {
                browserHistory.push({
                  pathname: `/organizations/${organization.slug}/dashboards/`,
                  query: {},
                });
                return;
              }

              browserHistory.push({
                pathname: `/organizations/${organization.slug}/dashboards/${value.id}/`,
                query: {},
              });
            }}
          />
        </DashboardSelect>
        <Button
          onClick={e => {
            e.preventDefault();
            onCreate();
          }}
          priority="primary"
          icon={<IconAdd size="xs" isCircled />}
          size="small"
        >
          {t('Create Dashboard')}
        </Button>
      </ButtonBar>
    );
  }
}

const DashboardSelect = styled('div')`
  min-width: 200px;
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default Controls;
