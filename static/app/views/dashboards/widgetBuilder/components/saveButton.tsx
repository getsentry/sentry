import {useCallback} from 'react';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {Widget} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';

interface SaveButtonProps {
  isEditing: boolean;
  onSave: ({index, widget}: {index: number; widget: Widget}) => void;
}

function SaveButton({isEditing, onSave}: SaveButtonProps) {
  const {state} = useWidgetBuilderContext();
  const {widgetIndex} = useParams();
  const api = useApi();
  const organization = useOrganization();

  const handleSave = useCallback(async () => {
    const widget = convertBuilderStateToWidget(state);
    try {
      await validateWidget(api, organization.slug, widget);
      onSave({index: Number(widgetIndex), widget});
    } catch (error) {
      addErrorMessage(t('Unable to save widget'));
    }
  }, [api, onSave, organization.slug, state, widgetIndex]);

  return (
    <Button priority="primary" onClick={handleSave}>
      {isEditing ? t('Update Widget') : t('Add Widget')}
    </Button>
  );
}

export default SaveButton;
