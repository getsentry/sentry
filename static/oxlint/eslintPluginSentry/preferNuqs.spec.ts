import {RuleTester} from 'oxlint/plugins-dev';

import {preferNuqs} from './preferNuqs';

const ruleTester = new RuleTester({languageOptions: {parserOptions: {lang: 'ts'}}});

ruleTester.run('prefer-nuqs', preferNuqs, {
  valid: [
    {code: "navigate({pathname: '/other/', query: {tab: 'details'}});"},
    {code: 'navigate({pathname, query});'},
    {code: 'navigate({pathname: location.pathname + "/details/", query});'},
    {code: 'navigate({pathname: otherLocation.pathname, query});'},
    {code: 'navigate({pathname: location["pathname"], query});'},
    {code: 'navigate({pathname: location.pathname});'},
    {code: 'navigate({...location});'},
    {code: 'navigate({query, ...location});'},
    {code: 'navigate({...location, query, ...location});'},
    {code: 'navigate({...target, query});'},
    {code: 'navigate({query, ...target});'},
    {code: 'navigate({...location, query, hash: "#details"});'},
    {code: 'navigate({query, state: {open: true}});'},
    {code: 'navigate({query, search: "?tab=details"});'},
    {code: 'navigate({query}, {state: {open: true}});'},
    {code: 'navigate({query}, {"state": null});'},
    {code: 'navigate({query}, {...options});'},
    {code: 'navigate({query}, {[option]: true});'},
    {code: 'navigate({query}, options);'},
    {code: 'navigate({[key]: query});'},
    {code: 'navigate({["query"]: query});'},
    {code: 'navigate({query() { return {}; }});'},
    {code: 'navigate({get query() { return {}; }});'},
    {code: 'navigate({set query(value) {}});'},
    {code: 'navigate({});'},
    {code: 'navigate(target);'},
    {code: 'navigate();'},
    {code: 'navigate(-1);'},
    {code: 'navigate("?tab=details");'},
    {code: 'update({query});'},
    {code: 'router.push({query});'},
    {code: 'router[method]({query});'},
  ],
  invalid: [
    {
      code: 'navigate({pathname: location.pathname, query: {...location.query, tab: "details"}});',
      errors: [{messageId: 'preferNuqs'}],
    },
    {
      code: 'navigate({...location, query: {...location.query, tab: "details"}});',
      errors: [{messageId: 'preferNuqs'}],
    },
    {
      code: 'navigate({query: {tab: "details"}});',
      errors: [{messageId: 'preferNuqs'}],
    },
    {
      code: 'navigate({query});',
      errors: [{messageId: 'preferNuqs'}],
    },
    {
      code: 'navigate({"pathname": location.pathname, "query": nextQuery});',
      errors: [{messageId: 'preferNuqs'}],
    },
    {
      code: 'navigate({query: {...location.query, sort: "name", cursor: undefined}});',
      errors: [{messageId: 'preferNuqs'}],
    },
    {
      code: 'navigate({query}, {replace: true, preventScrollReset: true});',
      errors: [{messageId: 'preferNuqs'}],
    },
    {
      code: 'this.props.navigate({...location, query});',
      errors: [{messageId: 'preferNuqs'}],
    },
    {
      code: 'router.navigate({pathname: location.pathname, query});',
      errors: [{messageId: 'preferNuqs'}],
    },
    {
      code: 'navigate({query, ...location, query: nextQuery});',
      errors: [{messageId: 'preferNuqs'}],
    },
    {
      code: 'navigate({...location, query, pathname: location.pathname});',
      errors: [{messageId: 'preferNuqs'}],
    },
    {
      code: 'navigate({query: {}});',
      errors: [{messageId: 'preferNuqs'}],
    },
  ],
});
