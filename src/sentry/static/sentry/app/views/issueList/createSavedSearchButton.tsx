import React from 'react';

import {openModal} from 'app/actionCreators/modal';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import {IconAdd} from 'app/icons';
import {t} from 'app/locale';
import {LightWeightOrganization} from 'app/types';

import CreateSavedSearchModal from './createSavedSearchModal';

type Props = {
  query: string;
  organization: LightWeightOrganization;
  buttonClassName?: string;
  tooltipClassName?: string;
  iconOnly?: boolean;
  withTooltip?: boolean;
};

const CreateSavedSearchButton = ({
  buttonClassName,
  tooltipClassName,
  withTooltip,
  iconOnly,
  organization,
  ...rest
}: Props) => (
  <Access organization={organization} access={['org:write']}>
    <Button
      title={withTooltip ? t('Add to organization saved searches') : undefined}
      onClick={() =>
        openModal(deps => (
          <CreateSavedSearchModal organization={organization} {...rest} {...deps} />
        ))
      }
      data-test-id="save-current-search"
      size="zero"
      borderless
      type="button"
      aria-label={t('Add to organization saved searches')}
      icon={<IconAdd size="xs" />}
      className={buttonClassName}
      tooltipProps={{className: tooltipClassName}}
    >
      {!iconOnly && t('Create Saved Search')}
    </Button>
  </Access>
);

export default CreateSavedSearchButton;
