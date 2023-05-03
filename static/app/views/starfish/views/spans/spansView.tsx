import {Location} from 'history';

type Props = {
  location: Location;
};

export default function SpansView(props: Props) {
  return <div>{props.location.pathname}</div>;
}
