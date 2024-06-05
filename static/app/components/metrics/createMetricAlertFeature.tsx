import Feature, {type ChildrenRenderFn} from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Hovercard} from 'sentry/components/hovercard';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  children: React.ReactNode | ChildrenRenderFn;
}

export function CreateMetricAlertFeature({children}: Props) {
  const organization = useOrganization();
  const hasPermission = organization.access.includes('alerts:write');
  return (
    <Feature
      features={['organizations:incidents']}
      organization={organization}
      hookName="feature-disabled:create-metrics-alert-tooltip"
      renderDisabled={p => (
        <Hovercard
          body={
            <FeatureDisabled
              features={p.features}
              hideHelpToggle
              featureName={t('Metric Alerts')}
            />
          }
        >
          {typeof p.children === 'function' ? p.children(p) : p.children}
        </Hovercard>
      )}
    >
      {p => (
        <Tooltip
          title={t('You do not have permission to create alerts')}
          disabled={!p.hasFeature || hasPermission}
        >
          {typeof children === 'function'
            ? children({...p, hasFeature: p.hasFeature && hasPermission})
            : children}
        </Tooltip>
      )}
    </Feature>
  );
}
