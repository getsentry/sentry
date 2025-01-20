import {useCallback, useState} from 'react';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addLoadingMessage} from 'sentry/actionCreators/indicator';
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
  setError: (error: Record<string, any>) => void;
}

function SaveButton({isEditing, onSave, setError}: SaveButtonProps) {
  const {state} = useWidgetBuilderContext();
  const {widgetIndex} = useParams();
  const api = useApi();
  const organization = useOrganization();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const widget = convertBuilderStateToWidget(state);
    setIsSaving(true);
    try {
      await validateWidget(api, organization.slug, widget);
      addLoadingMessage(t('Saving widget'));
      onSave({index: Number(widgetIndex), widget});
    } catch (error) {
      setIsSaving(false);
      const errorDetails = error.responseJSON || error;
      setError(errorDetails);
      addErrorMessage(t('Unable to save widget'));
    }
  }, [api, onSave, organization.slug, state, widgetIndex, setError]);

  return (
    <Button priority="primary" onClick={handleSave} busy={isSaving}>
      {isEditing ? t('Update Widget') : t('Add Widget')}
    </Button>
  );
}

export default SaveButton;
