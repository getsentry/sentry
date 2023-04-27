import {Fragment} from 'react';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Scope} from 'sentry/types';
import {isRenderFunc} from 'sentry/utils/isRenderFunc';
import useOrganization from 'sentry/utils/useOrganization';

// Props that function children will get.
type ChildRenderProps = {
  hasAccess: boolean;
  hasSuperuser: boolean;
};

type ChildFunction = (props: ChildRenderProps) => JSX.Element;

type Props = {
  /**
   * List of required access levels
   */
  access?: Scope[];
  /**
   * Children can be a node or a function as child.
   */
  children?: React.ReactNode | ChildFunction;
  /**
   * Requires superuser
   */
  isSuperuser?: boolean;
};

/**
 * Component to handle access restrictions.
 */
function Access({children, isSuperuser = false, access = []}: Props) {
  const config = useLegacyStore(ConfigStore);
  const organization = useOrganization();

  const {access: orgAccess} = organization || {access: []};

  const hasAccess = !access || access.every(acc => orgAccess.includes(acc));
  const hasSuperuser = !!(config.user && config.user.isSuperuser);

  const renderProps: ChildRenderProps = {
    hasAccess,
    hasSuperuser,
  };

  const render = hasAccess && (!isSuperuser || hasSuperuser);

  if (isRenderFunc<ChildFunction>(children)) {
    return children(renderProps);
  }

  return <Fragment>{render ? children : null}</Fragment>;
}

export default Access;
