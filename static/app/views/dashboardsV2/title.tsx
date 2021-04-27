import React from 'react';
import styled from '@emotion/styled';

import EditableText from 'app/components/editableText';
import {t} from 'app/locale';

import {DashboardDetails} from './types';

type Props = {
  dashboard: DashboardDetails | null;
  isEditing: boolean;
  onUpdate: (dashboard: DashboardDetails) => void;
};

function DashboardTitle({dashboard, isEditing, onUpdate}: Props) {
  return (
    <Container>
      {!dashboard ? (
        t('Dashboards')
      ) : (
        <EditableText
          isDisabled={!isEditing}
          value={dashboard.title}
          onChange={newTitle => onUpdate({...dashboard, title: newTitle})}
          errorMessage={t('Please set a title for this dashboard')}
          successMessage={t('Dashboard title updated successfully')}
        />
      )}
    </Container>
  );
}

export default DashboardTitle;

const Container = styled('div')``;
