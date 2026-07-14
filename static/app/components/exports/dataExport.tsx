import {useEffect} from 'react';

import {Button} from '@sentry/scraps/button';

import Feature from 'sentry/components/acl/feature';
import {
  useDataExport,
  type DataExportPayload,
} from 'sentry/components/exports/useDataExport';
import {t} from 'sentry/locale';

export interface LogsQueryInfo {
  dataset: 'logs';
  field: string[];
  project: number[];
  query: string;
  sort: string[];
  end?: string;
  environment?: string[];
  start?: string;
  statsPeriod?: string;
}

interface DataExportProps {
  payload: DataExportPayload;
  children?: React.ReactNode;
  disabled?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  overrideFeatureFlags?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

export function DataExport({
  children,
  disabled,
  payload,
  icon,
  size = 'sm',
  overrideFeatureFlags,
  onClick,
}: DataExportProps): React.ReactElement {
  const {mutate, reset, isPending, isSuccess} = useDataExport();
  const inProgress = isPending || isSuccess;

  // We clear the indicator if export props change so that the user
  // can fire another export without having to wait for the previous one to finish.
  useEffect(() => {
    reset();
  }, [payload.queryType, payload.queryInfo, reset]);

  const handleClick = () => {
    mutate(payload);
    onClick?.();
  };

  return (
    <Feature features={overrideFeatureFlags ? [] : 'organizations:discover-query'}>
      {inProgress ? (
        <Button
          size={size}
          variant="secondary"
          tooltipProps={{
            title: t(
              "You can get on with your life. We'll email you when your data's ready."
            ),
          }}
          disabled
          icon={icon}
        >
          {t("We're working on it...")}
        </Button>
      ) : (
        <Button
          onClick={handleClick}
          disabled={disabled || false}
          size={size}
          variant="secondary"
          tooltipProps={{
            title: t(
              "Put your data to work. Start your export and we'll email you when it's finished."
            ),
          }}
          icon={icon}
        >
          {children ? children : t('Export All to CSV')}
        </Button>
      )}
    </Feature>
  );
}
