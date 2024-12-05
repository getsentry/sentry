import {useCallback} from 'react';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
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

  const handleSave = useCallback(() => {
    const widget = convertBuilderStateToWidget(state);
    onSave({index: Number(widgetIndex), widget});
  }, [onSave, state, widgetIndex]);

  return (
    <Button priority="primary" onClick={handleSave}>
      {isEditing ? t('Update Widget') : t('Add Widget')}
    </Button>
  );
}

export default SaveButton;
