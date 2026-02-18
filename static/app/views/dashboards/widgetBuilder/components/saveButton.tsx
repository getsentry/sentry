import {useCallback, useState} from 'react';

import {Button} from '@sentry/scraps/button';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import {DatasetSource} from 'sentry/utils/discover/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {WidgetType, type Widget} from 'sentry/views/dashboards/types';
import {flattenErrors} from 'sentry/views/dashboards/utils';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useDisableTransactionWidget} from 'sentry/views/dashboards/widgetBuilder/hooks/useDisableTransactionWidget';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';

export interface SaveButtonProps {
  isEditing: boolean;
  onSave: ({index, widget}: {index: number | undefined; widget: Widget}) => void;
  setError: (error: Record<string, any>) => void;
}

function SaveButton({isEditing, onSave, setError}: SaveButtonProps) {
  const {state} = useWidgetBuilderContext();
  const {widgetIndex} = useParams();
  const api = useApi();
  const organization = useOrganization();
  const [isSaving, setIsSaving] = useState(false);
  const disableTransactionWidget = useDisableTransactionWidget();

  const handleSave = useCallback(async () => {
    trackAnalytics('dashboards_views.widget_builder.save', {
      builder_version: WidgetBuilderVersion.SLIDEOUT,
      data_set: state.dataset ?? '',
      new_widget: !isEditing,
      organization,
    });
    const widget = convertBuilderStateToWidget(state);
    if (widget.widgetType === WidgetType.SPANS) {
      widget.datasetSource = DatasetSource.USER;
    }
    setIsSaving(true);
    try {
      await validateWidget(api, organization.slug, widget);
      onSave({index: defined(widgetIndex) ? Number(widgetIndex) : undefined, widget});
    } catch (error: any) {
      let errorMessage = t('Unable to save widget');
      setIsSaving(false);
      const errorDetails = flattenErrors(error.responseJSON || error, {});
      setError(errorDetails);

      if (Object.keys(errorDetails).length > 0) {
        errorMessage = errorDetails[Object.keys(errorDetails)[0]!] as string;
      }
      addErrorMessage(errorMessage);
    }
  }, [api, onSave, organization, state, widgetIndex, setError, isEditing]);

  return (
    <Button
      priority="primary"
      onClick={handleSave}
      busy={isSaving}
      disabled={disableTransactionWidget}
    >
      {isEditing ? t('Update Widget') : t('Add Widget')}
    </Button>
  );
}

export default SaveButton;
