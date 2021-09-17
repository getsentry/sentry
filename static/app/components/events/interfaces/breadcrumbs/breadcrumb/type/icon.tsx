import {
  IconFire,
  IconFix,
  IconInfo,
  IconLocation,
  IconMobile,
  IconRefresh,
  IconSpan,
  IconStack,
  IconSwitch,
  IconTerminal,
  IconUser,
  IconWarning,
} from 'app/icons';
import SvgIcon from 'app/icons/svgIcon';
import {BreadcrumbType} from 'app/types/breadcrumbs';

type Props = Pick<React.ComponentProps<typeof SvgIcon>, 'size'> & {
  type: BreadcrumbType;
};

function Icon({type, size}: Props) {
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
      return <IconSwitch size={size} />;
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
