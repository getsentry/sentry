import {
  IconFire,
  IconFix,
  IconInfo,
  IconLocation,
  IconMobile,
  IconRefresh,
  IconSort,
  IconSpan,
  IconStack,
  IconTerminal,
  IconUser,
  IconWarning,
} from 'sentry/icons';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';

type Props = {
  type: BreadcrumbType;
  size?: string;
};

function Icon({type, size = 'xs'}: Props) {
  switch (type) {
    case BreadcrumbType.USER:
    case BreadcrumbType.UI:
      return <IconUser size={size} />;
    case BreadcrumbType.NAVIGATION:
      return <IconLocation size={size} />;
    case BreadcrumbType.DEBUG:
      return <IconFix size={size} />;
    case BreadcrumbType.INFO:
      return <IconInfo size={size} />;
    case BreadcrumbType.ERROR:
      return <IconFire size={size} />;
    case BreadcrumbType.HTTP:
      return <IconSort size={size} rotated />;
    case BreadcrumbType.WARNING:
      return <IconWarning size={size} />;
    case BreadcrumbType.QUERY:
      return <IconStack size={size} />;
    case BreadcrumbType.SYSTEM:
      return <IconMobile size={size} />;
    case BreadcrumbType.SESSION:
      return <IconRefresh size={size} />;
    case BreadcrumbType.TRANSACTION:
      return <IconSpan size={size} />;
    default:
      return <IconTerminal size={size} />;
  }
}

export default Icon;
