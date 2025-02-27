import type {ChildrenRenderFn} from 'sentry/components/acl/feature';
import Tag from 'sentry/components/badge/tag';
import {Button} from 'sentry/components/button';
import {IconBusiness} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import {displayPlanName} from 'getsentry/utils/billing';

import PlanFeature from './planFeature';

type ChildRenderProps = Parameters<ChildrenRenderFn>[0] & {
  renderInstallButton: (props: any) => React.ReactNode;
};

type ChildRenderFunction = (options: ChildRenderProps) => React.ReactNode;

type Props = {
  children: React.ReactNode | ChildRenderFunction;
  features: string[];
  hasFeature: boolean;
  organization: Organization;
};

function DisabledAuthProvider({organization, features, children, ...props}: Props) {
  return (
    <PlanFeature {...{organization, features}}>
      {({plan}) =>
        typeof children === 'function'
          ? children({
              ...props,
              organization,
              features,
              renderDisabled: () => (
                <Tag icon={<IconBusiness />}>{t('%s Plan', displayPlanName(plan))}</Tag>
              ),
              renderInstallButton: p => (
                <Button
                  size="sm"
                  priority="primary"
                  icon={<IconBusiness />}
                  onClick={() =>
                    openUpsellModal({
                      organization,
                      source: `feature.auth_provider.${p.provider.key}`,
                      defaultSelection: 'sso',
                    })
                  }
                >
                  {t('Learn More')}
                </Button>
              ),
            })
          : children
      }
    </PlanFeature>
  );
}

export default DisabledAuthProvider;
