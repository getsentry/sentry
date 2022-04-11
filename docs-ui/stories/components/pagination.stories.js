import Pagination from 'sentry/components/pagination';

export default {
  title: 'Components/Buttons/Pagination',
  component: Pagination,
};

const withBoth = `<https://sentry.io/api/0/organizations/sentry/issues/?cursor=1603798246000:0:1>; rel="previous"; results="true"; cursor="1603798246000:0:1",
<https://sentry.io/api/0/organizations/sentry/issues/?cursor=1603719405000:0:0>; rel="next"; results="true"; cursor="1603719405000:0:0"
`;

const withNext = `<https://sentry.io/api/0/organizations/sentry/issues/?cursor=1603798246000:0:1>; rel="previous"; results="false"; cursor="1603798246000:0:1",
<https://sentry.io/api/0/organizations/sentry/issues/?cursor=1603719405000:0:0>; rel="next"; results="true"; cursor="1603719405000:0:0"
`;

export const Default = () => {
  return (
    <div>
      <div className="section">
        <h3>Both enabled</h3>
        <Pagination location={window.location} pageLinks={withBoth} />
      </div>
      <div className="section">
        <h3>Only next enabled</h3>
        <Pagination location={window.location} pageLinks={withNext} />
      </div>
    </div>
  );
};

Default.storyName = 'Pagination';
