import {Button} from 'sentry/components/button';
import {IconBusiness} from 'sentry/icons';
import {t} from 'sentry/locale';

import UpsellProvider from 'getsentry/components/upsellProvider';

type RenderShowAllButtonProps = {
  canShowAllProjects: boolean;
  onButtonClick: () => void;
};

type ChildRenderProps = {
  renderShowAllButton?: (p: RenderShowAllButtonProps) => React.ReactNode;
};

type ChildRenderFunction = (options: ChildRenderProps) => React.ReactNode;

type Props = {
  children: React.ReactNode | ChildRenderFunction;
};

const DisabledAllProjectsSelect: React.FC<Props> = ({children}: Props) => {
  return typeof children === 'function'
    ? children({
        renderShowAllButton: ({onButtonClick}) => {
          const getButtonText = (hasBillingScope: boolean, canTrial: boolean) => {
            // if the user has billing scope, they can always see all projects
            if (hasBillingScope) {
              return canTrial
                ? t('Start Free Trial to Select All')
                : t('Upgrade to Select All');
            }
            return canTrial
              ? t('Request Free Trial to Select All')
              : t('Request Upgrade to Select All');
          };

          // if free plan, show the upsell for upgrade or trial if it's available
          return (
            <UpsellProvider
              source="all-projects-select"
              onTrialStarted={onButtonClick}
              showConfirmation
              triggerMemberRequests
            >
              {({canTrial, onClick, hasBillingScope}) => {
                return (
                  <Button
                    priority="primary"
                    size="xs"
                    onClick={onClick}
                    icon={<IconBusiness />}
                  >
                    {getButtonText(hasBillingScope, canTrial)}
                  </Button>
                );
              }}
            </UpsellProvider>
          );
        },
      })
    : children;
};

export default DisabledAllProjectsSelect;
