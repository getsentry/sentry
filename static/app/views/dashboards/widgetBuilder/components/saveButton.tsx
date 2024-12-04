import {useCallback} from 'react';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import type {Widget} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';

interface SaveButtonProps {
  isEditing: boolean;
  onSave: (widget: Widget) => void;
}

function SaveButton({isEditing, onSave}: SaveButtonProps) {
  const {state} = useWidgetBuilderContext();

  const widget = convertBuilderStateToWidget(state);

  const handleSave = useCallback(() => {
    onSave(widget);
  }, [onSave, widget]);

  return (
    <Button priority="primary" onClick={handleSave}>
      {isEditing ? t('Update Widget') : t('Add Widget')}
    </Button>
  );
}

export default SaveButton;
