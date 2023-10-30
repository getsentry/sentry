import omit from 'lodash/omit';
import pick from 'lodash/pick';

import {escapeDoubleQuotes} from 'sentry/utils';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {escapeFilterValue} from 'sentry/utils/tokenizeSearch';

type HasMeasurementsProps = {
  transaction: string;
  type: 'web' | 'mobile';
};

type RequestProps = DiscoverQueryProps & HasMeasurementsProps;

type HasMeasurements = {measurements: boolean};

type ChildrenProps = Omit<GenericChildrenProps<HasMeasurementsProps>, 'tableData'> & {
  hasMeasurements: boolean | null;
};

type Props = RequestProps & {
  children: (props: ChildrenProps) => React.ReactNode;
};

function getHasMeasurementsRequestPayload(props: RequestProps) {
  const {eventView, location, transaction, type} = props;
  const escaped = escapeDoubleQuotes(escapeFilterValue(transaction));
  const baseApiPayload = {
    transaction: `"${escaped}"`,
    type,
  };
  const additionalApiPayload = pick(eventView.getEventsAPIPayload(location), [
    'project',
    'environment',
  ]);
  return Object.assign(baseApiPayload, additionalApiPayload);
}

function HasMeasurementsQuery(props: Props) {
  return (
    <GenericDiscoverQuery<HasMeasurements, HasMeasurementsProps>
      route="events-has-measurements"
      getRequestPayload={getHasMeasurementsRequestPayload}
      {...omit(props, 'children')}
    >
      {({tableData, ...rest}) => {
        return props.children({
          hasMeasurements: tableData?.measurements ?? null,
          ...rest,
        });
      }}
    </GenericDiscoverQuery>
  );
}

export default HasMeasurementsQuery;
