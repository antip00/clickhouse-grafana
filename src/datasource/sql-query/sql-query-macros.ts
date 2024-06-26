import { each } from 'lodash';
import { SqlQueryHelper } from './sql-query-helper';
import {TimestampFormat} from "../../types/types";

export interface RawTimeRange {
  from: any | string;
  to: any | string;
}

export interface TimeRange {
  from: any;
  to: any;
  raw: RawTimeRange;
}
export default class SqlQueryMacros {
  static applyMacros(query: string, ast: any): string {
    if (SqlQueryHelper.contain(ast, '$columns')) {
      return SqlQueryMacros.columns(query, ast);
    }
    if (SqlQueryHelper.contain(ast, '$rate')) {
      return SqlQueryMacros.rate(query, ast);
    }
    if (SqlQueryHelper.contain(ast, '$rateColumns')) {
      return SqlQueryMacros.rateColumns(query, ast);
    }
    if (SqlQueryHelper.contain(ast, '$rateColumnsAggregated')) {
      return SqlQueryMacros.rateColumnsAggregated(query, ast);
    }
    if (SqlQueryHelper.contain(ast, '$perSecond')) {
      return SqlQueryMacros.perSecond(query, ast);
    }
    if (SqlQueryHelper.contain(ast, '$perSecondColumns')) {
      return SqlQueryMacros.perSecondColumns(query, ast);
    }
    if (SqlQueryHelper.contain(ast, '$perSecondColumnsAggregated')) {
      return SqlQueryMacros.perSecondColumnsAggregated(query, ast);
    }
    if (SqlQueryHelper.contain(ast, '$increase')) {
      return SqlQueryMacros.increase(query, ast);
    }
    if (SqlQueryHelper.contain(ast, '$increaseColumns')) {
      return SqlQueryMacros.increaseColumns(query, ast);
    }
    if (SqlQueryHelper.contain(ast, '$increaseColumnsAggregated')) {
      return SqlQueryMacros.increaseColumnsAggregated(query, ast);
    }
    if (SqlQueryHelper.contain(ast, '$delta')) {
      return SqlQueryMacros.delta(query, ast);
    }
    if (SqlQueryHelper.contain(ast, '$deltaColumns')) {
      return SqlQueryMacros.deltaColumns(query, ast);
    }
    if (SqlQueryHelper.contain(ast, '$deltaColumnsAggregated')) {
      return SqlQueryMacros.deltaColumnsAggregated(query, ast);
    }
    return query;
  }

  static getDateFilter(): string {
    return '$dateCol >= toDate($from) AND $dateCol <= toDate($to)';
  }

  static getDateTimeFilter(dateTimeType: string) {
    let convertFn = function (t: string): string {
      if (dateTimeType === TimestampFormat.DateTime) {
        return 'toDateTime(' + t + ')';
      }
      if (dateTimeType === TimestampFormat.DateTime64) {
        return 'toDateTime64(' + t + ', 3)';
      }
      return t;
    };
    return '$dateTimeCol >= ' + convertFn('$from') + ' AND $dateTimeCol <= ' + convertFn('$to');
  }

  static getDateTimeFilterMs(dateTimeType: string) {
    let convertFn = function (t: string): string {
      if (dateTimeType === TimestampFormat.DateTime) {
        return 'toDateTime(' + t + ')';
      }
      if (dateTimeType === TimestampFormat.DateTime64) {
        return 'toDateTime64(' + t + ', 3)';
      }
      return '(' + t + ')';
    };
    return '$dateTimeCol >= ' + convertFn('$__from/1000') + ' AND $dateTimeCol <= ' + convertFn('$__to/1000');
  }

  static getTimeSeries(dateTimeType: string): string {
    if (dateTimeType === TimestampFormat.DateTime) {
      return '(intDiv(toUInt32($dateTimeCol), $interval) * $interval) * 1000';
    }
    if (dateTimeType === TimestampFormat.DateTime64) {
      return '(intDiv(toFloat64($dateTimeCol) * 1000, ($interval * 1000)) * ($interval * 1000))';
    }
    return '(intDiv($dateTimeCol, $interval) * $interval) * 1000';
  }

  static getTimeSeriesMs(dateTimeType: string): string {
    if (dateTimeType === TimestampFormat.DateTime) {
      return '(intDiv(toUInt32($dateTimeCol) * 1000, $__interval_ms) * $__interval_ms)';
    }
    if (dateTimeType === TimestampFormat.DateTime64) {
      return '(intDiv(toFloat64($dateTimeCol) * 1000, $__interval_ms) * $__interval_ms)';
    }
    return '(intDiv($dateTimeCol, $__interval_ms) * $__interval_ms)';
  }

  static getNaturalTimeSeries(dateTimeType: string, from: number, to: number): string {
    let SOME_MINUTES = 60 * 20;
    let FEW_HOURS = 60 * 60 * 4;
    let SOME_HOURS = 60 * 60 * 24;
    let MANY_HOURS = 60 * 60 * 72;
    let FEW_DAYS = 60 * 60 * 24 * 15;
    let MANY_WEEKS = 60 * 60 * 24 * 7 * 15;
    let FEW_MONTHS = 60 * 60 * 24 * 30 * 10;
    let FEW_YEARS = 60 * 60 * 24 * 365 * 6;
    if (dateTimeType === TimestampFormat.DateTime || dateTimeType === TimestampFormat.DateTime64) {
      let duration = to - from;
      if (duration < SOME_MINUTES) {
        return 'toUInt32($dateTimeCol) * 1000';
      } else if (duration < FEW_HOURS) {
        return 'toUInt32(toStartOfMinute($dateTimeCol)) * 1000';
      } else if (duration < SOME_HOURS) {
        return 'toUInt32(toStartOfFiveMinute($dateTimeCol)) * 1000';
      } else if (duration < MANY_HOURS) {
        return 'toUInt32(toStartOfFifteenMinutes($dateTimeCol)) * 1000';
      } else if (duration < FEW_DAYS) {
        return 'toUInt32(toStartOfHour($dateTimeCol)) * 1000';
      } else if (duration < MANY_WEEKS) {
        return 'toUInt32(toStartOfDay($dateTimeCol)) * 1000';
      } else if (duration < FEW_MONTHS) {
        return 'toUInt32(toDateTime(toMonday($dateTimeCol))) * 1000';
      } else if (duration < FEW_YEARS) {
        return 'toUInt32(toDateTime(toStartOfMonth($dateTimeCol))) * 1000';
      } else {
        return 'toUInt32(toDateTime(toStartOfQuarter($dateTimeCol))) * 1000';
      }
    }
    return '(intDiv($dateTimeCol, $interval) * $interval) * 1000';
  }

  static delta(query: string, ast: any): string {
    let [beforeMacrosQuery, fromQuery] = SqlQueryMacros._parseMacro('$delta', query);
    if (fromQuery.length < 1) {
      return query;
    }
    let args = ast['$delta'];
    if (args.length < 1) {
      throw {message: 'Amount of arguments must be > 0 for $delta func. Parsed arguments are:  ' + args.join(', ')};
    }

    each(args, function (a, i) {
      args[i] = 'max(' + a.trim() + ') AS max_' + i;
    });

    let cols: string[] = [];
    each(args, function (a, i) {
      cols.push('runningDifference(max_' + i + ') AS max_' + i + '_Delta');
    });

    fromQuery = SqlQueryMacros._applyTimeFilter(fromQuery);
    return beforeMacrosQuery + 'SELECT ' +
      't,' +
      ' ' + cols.join(', ') +
      ' FROM (' +
      ' SELECT $timeSeries AS t,' +
      ' ' + args.join(', ') +
      ' ' + fromQuery +
      ' GROUP BY t' +
      ' ORDER BY t' +
      ')';
  }

  static _parseMacro(macro: string, query: string): string[] {
    const _fromIndex = (query: string, macro: string): number => {
      let fromRe = new RegExp('\\' + macro + '\\([\\w\\s\\S]+?\\)(\\s+FROM\\s+)', 'gim');
      let matches = fromRe.exec(query);
      if (matches === null || matches.length === 0) {
        throw { message: 'Could not find FROM-statement at: ' + query };
      }
      let fromRelativeIndex = matches[matches.length - 1].toLocaleLowerCase().indexOf('from');
      return fromRe.lastIndex - matches[matches.length - 1].length + fromRelativeIndex;
    };

    let mLen = macro.length;
    let mPos = query.indexOf(macro);
    if (mPos === -1 || query.slice(mPos, mPos + mLen + 1) !== macro + '(') {
      return [query, ''];
    }
    let fromIndex = _fromIndex(query, macro);
    return [query.slice(0, mPos), query.slice(fromIndex)];
  }

  static _applyTimeFilter(query: string): string {
    return query.toLowerCase().includes('where')
      ? query.replace(/where/gi, 'WHERE $timeFilter AND')
      : `${query} WHERE $timeFilter`;
  }

  static transformQuery(
    query: string,
    ast: any,
    macro: string,
    transformation: (args: string[], cols: string[]) => void
  ): string {
    let [beforeMacrosQuery, fromQuery] = SqlQueryMacros._parseMacro(macro, query);
    if (fromQuery.length < 1) {
      return query;
    }
    let args = ast[macro];
    if (args.length < 1) {
      throw { message: `Amount of arguments must be > 0 for ${macro} func. Parsed arguments are:  ${args.join(', ')}` };
    }

    let cols: any[] = [];
    transformation(args, cols);

    fromQuery = SqlQueryMacros._applyTimeFilter(fromQuery);
    return (
      beforeMacrosQuery +
      'SELECT ' +
      't,' +
      ' ' +
      cols.join(', ') +
      ' FROM (' +
      ' SELECT $timeSeries AS t,' +
      ' ' +
      args.join(', ') +
      ' ' +
      fromQuery +
      ' GROUP BY t' +
      ' ORDER BY t' +
      ')'
    );
  }

  static increase(query: string, ast: any): string {
    let [beforeMacrosQuery, fromQuery] = SqlQueryMacros._parseMacro('$increase', query);
    if (fromQuery.length < 1) {
      return query;
    }
    let args = ast['$increase'];
    if (args.length < 1) {
      throw {message: 'Amount of arguments must be > 0 for $increase func. Parsed arguments are:  ' + args.join(', ')};
    }

    each(args, function (a, i) {
      args[i] = 'max(' + a.trim() + ') AS max_' + i;
    });

    let cols: string[] = [];
    each(args, function (a, i) {
      cols.push('if(runningDifference(max_' + i + ') < 0, 0, runningDifference(max_' + i + ')) AS max_' + i + '_Increase');
    });

    fromQuery = SqlQueryMacros._applyTimeFilter(fromQuery);
    return beforeMacrosQuery + 'SELECT ' +
      't,' +
      ' ' + cols.join(', ') +
      ' FROM (' +
      ' SELECT $timeSeries AS t,' +
      ' ' + args.join(', ') +
      ' ' + fromQuery +
      ' GROUP BY t' +
      ' ORDER BY t' +
      ')';
  }

  static perSecond(query: string, ast: any): string {
    let [beforeMacrosQuery, fromQuery] = SqlQueryMacros._parseMacro('$perSecond', query);
    if (fromQuery.length < 1) {
      return query;
    }
    let args = ast['$perSecond'];
    if (args.length < 1) {
      throw {message: 'Amount of arguments must be > 0 for $perSecond func. Parsed arguments are:  ' + args.join(', ')};
    }

    each(args, function (a, i) {
      args[i] = 'max(' + a.trim() + ') AS max_' + i;
    });

    let cols: string[] = [];
    each(args, function (a, i) {
      cols.push('if(runningDifference(max_' + i + ') < 0, nan, ' +
        'runningDifference(max_' + i + ') / runningDifference(t/1000)) AS max_' + i + '_PerSecond');
    });

    fromQuery = SqlQueryMacros._applyTimeFilter(fromQuery);

    return beforeMacrosQuery + 'SELECT ' +
      't,' +
      ' ' + cols.join(', ') +
      ' FROM (' +
      ' SELECT $timeSeries AS t,' +
      ' ' + args.join(', ') +
      ' ' + fromQuery +
      ' GROUP BY t' +
      ' ORDER BY t' +
      ')';
  }

  static rate(query: string, ast: any): string {
    return SqlQueryMacros.transformQuery(query, ast, '$rate', function (args, cols) {
      let aliases: any[] = [];
      each(args, function (arg) {
        if (arg.slice(-1) === ')') {
          throw { message: 'Argument "' + arg + '" cant be used without alias' };
        }
        aliases.push(arg.trim().split(' ').pop());
      });

      each(aliases, function (a) {
        cols.push(a + '/runningDifference(t/1000) ' + a + 'Rate');
      });
    });
  }

  static _columns(key: string, value: string, beforeMacrosQuery: string, fromQuery: string): string {
    if (key.slice(-1) === ')' || value.slice(-1) === ')') {
      throw { message: 'Some of passed arguments are without aliases: ' + key + ', ' + value };
    }

    let keyAlias = key.trim().split(' ').pop(),
      valueAlias = value.trim().split(' ').pop();

    let groupByQuery = ' GROUP BY t, ' + keyAlias;
    let havingQuery = '';
    let orderByQuery = ' ORDER BY t, ' + keyAlias;
    const fromRe = /^\s*FROM\s*\(/mi;
    if (!fromRe.test(fromQuery)) {

      function findKeywordOutsideBrackets(query, keyword) {
        // This regex will match the keyword only if it is not within brackets.
        const regex = new RegExp(
          `(?<!\\([^)]*)${keyword}(?![^(]*\\))`,
          'gi'
        );

        const match = regex.exec(query);
        return match ? match.index : -1;
      }

      const groupByIndex = findKeywordOutsideBrackets(fromQuery, 'group by')
      const havingIndex = findKeywordOutsideBrackets(fromQuery, 'having')
      const orderByIndex = findKeywordOutsideBrackets(fromQuery, 'order by')

      if (havingIndex >= 0 && orderByIndex >= 0 &&  havingIndex >= orderByIndex) {
        throw {message: "ORDER BY clause shall be before HAVING"};
      }

      if (groupByIndex >= 0 && orderByIndex >= 0 && groupByIndex >= orderByIndex) {
        throw {message: "GROUP BY clause shall be before ORDER BY"};
      }

      if (groupByIndex >= 0 && havingIndex >= 0 && groupByIndex >= havingIndex) {
        throw {message: "GROUP BY clause shall be before HAVING"};
      }


      if (orderByIndex !== -1) {
        orderByQuery = ' ' + fromQuery.slice(orderByIndex, fromQuery.length);
        fromQuery = fromQuery.slice(0, orderByIndex - 1);
      }

      if (havingIndex !== -1) {
        havingQuery = ' ' + fromQuery.slice(havingIndex, fromQuery.length);
        fromQuery = fromQuery.slice(0, havingIndex - 1);
      }

      if (groupByIndex !== -1) {
        groupByQuery = ' ' + fromQuery.slice(groupByIndex, fromQuery.length);
        fromQuery = fromQuery.slice(0, groupByIndex - 1);
      }
    }
    fromQuery = SqlQueryMacros._applyTimeFilter(fromQuery);

    return (
      beforeMacrosQuery +
      'SELECT' +
      ' t,' +
      ' groupArray((' +
      keyAlias +
      ', ' +
      valueAlias +
      ')) AS groupArr' +
      ' FROM (' +
      ' SELECT $timeSeries AS t' +
      ', ' +
      key +
      ', ' +
      value +
      ' ' +
      fromQuery +
      groupByQuery +
      havingQuery +
      orderByQuery +
      ')' +
      ' GROUP BY t' +
      ' ORDER BY t'
    );
  }

  static columns(query: string, ast: any): string {
    let [beforeMacrosQuery, fromQuery] = SqlQueryMacros._parseMacro('$columns', query);
    if (fromQuery.length < 1) {
      return query;
    }
    let args = ast['$columns'];
    if (args.length !== 2) {
      throw {
        message: 'Amount of arguments must equal 2 for $columns func. Parsed arguments are: ' + ast.$columns.join(', '),
      };
    }
    return SqlQueryMacros._columns(args[0], args[1], beforeMacrosQuery, fromQuery);
  }

  static rateColumns(query: string, ast: any): string {
    let [beforeMacrosQuery, fromQuery] = SqlQueryMacros._parseMacro('$rateColumns', query);
    if (fromQuery.length < 1) {
      return query;
    }
    let args = ast['$rateColumns'];
    if (args.length !== 2) {
      throw {
        message: 'Amount of arguments must equal 2 for $rateColumns func. Parsed arguments are: ' + args.join(', '),
      };
    }

    query = SqlQueryMacros._columns(args[0], args[1], '', fromQuery);
    return (
      beforeMacrosQuery +
      'SELECT t' +
      ', arrayMap(a -> (a.1, a.2/runningDifference( t/1000 )), groupArr)' +
      ' FROM (' +
      query +
      ')'
    );
  }
  /* https://github.com/Altinity/clickhouse-grafana/issues/386 */
  private static _prepareColumnsAggregated(macroName: string, query: string, ast: any): [string, string, string, string, string, string, string, string[], string[], string[]] {
    let [beforeMacrosQuery, fromQuery] = SqlQueryMacros._parseMacro(macroName, query);
    if (fromQuery.length < 1) {
      throw {
        message: 'Missing FROM section after '+macroName+' function. Query: ' + query,
      };
    }
    let args = ast[macroName];
    if (args.length < 4) {
      throw {
        message: 'Expect 2 or more amount of arguments for '+macroName+' function. Parsed arguments are: ' + args.join(', '),
      };
    }
    let havingIndex = fromQuery.toLowerCase().indexOf('having'),
      having = '';

    if (havingIndex !== -1) {
      having = ' ' + fromQuery.slice(havingIndex, fromQuery.length);
      fromQuery = fromQuery.slice(0, havingIndex - 1);
    }
    fromQuery = SqlQueryMacros._applyTimeFilter(fromQuery);

    let key = args[0];
    let keyAlias = key.trim().split(' ').pop();
    let subKey = args[1];
    let subKeyAlias = subKey.trim().split(' ').pop();

    if (args.length % 2 !== 0) {
      throw {
        message: 'Wrong arguments count, expect argument pairs aggregate function and value for $rateColumnsAggregated func. Parsed arguments are: ' + args.join(', '),
      };
    }
    const values: string[] = [];
    const aliases: string[] = [];
    const aggFuncs: string[] = [];
    for (let i = 2; i < args.length; i+=2) {
      aggFuncs.push(args[i]);

      let value = args[i+1]
      let aliasSplit = value.trim().split(' ')
      let alias = aliasSplit.pop()
      aliases.push(alias);

      if (aliasSplit.length > 1) {
        value = aliasSplit.join(' ').replace(/ AS$/i,"")
      }
      if (value.indexOf("(") === -1) {
        value = 'max('+value+')'
        values.push();
      }
      values.push(value + " AS " + alias)
    }
    return [beforeMacrosQuery, fromQuery, having, key, keyAlias, subKey, subKeyAlias, values, aliases, aggFuncs]
  }

  private static _formatColumnsAggregated(beforeMacrosQuery: string, keyAlias: string, finalAggregatedValues: string[], subKeyAlias: string, finalValues: string[], key: string, subKey: string, values: string[], fromQuery: string, having: string) {
    return (
      beforeMacrosQuery +
      'SELECT t, ' + keyAlias + ', ' + finalAggregatedValues.join(', ') +
      ' FROM (' +
      '  SELECT t, ' + keyAlias + ', ' + subKeyAlias + ', ' + finalValues.join(', ') +
      '  FROM (' +
      '   SELECT $timeSeries AS t, ' + key + ', ' + subKey + ', ' + values.join(', ') +
      '   ' + fromQuery +
      '   GROUP BY ' + keyAlias + ', ' + subKeyAlias + ', t ' + having +
      '   ORDER BY ' + keyAlias + ', ' + subKeyAlias + ', t' +
      '  )' +
      ' ) ' +
      'GROUP BY ' + keyAlias + ', t ORDER BY ' + keyAlias + ', t'
    );
  }

  static rateColumnsAggregated(query: string, ast: any): string {
    const [beforeMacrosQuery,
            fromQuery,
            having,
            key,
            keyAlias,
            subKey,
            subKeyAlias,
            values,
            aliases,
            aggFuncs] = SqlQueryMacros._prepareColumnsAggregated('$rateColumnsAggregated', query, ast)
    const finalAggregatedValues: string[] = [];
    const finalValues: string[] = [];
    aliases.forEach((a, i) => {
      finalAggregatedValues.push(aggFuncs[i]+"("+a + "Rate) AS " + a + "RateAgg");
      finalValues.push(a+" / runningDifference(t / 1000) AS "+a+"Rate");
    });

    return SqlQueryMacros._formatColumnsAggregated(beforeMacrosQuery, keyAlias, finalAggregatedValues, subKeyAlias, finalValues, key, subKey, values, fromQuery, having);
  }


  static _detectAliasAndApplyTimeFilter(
    aliasIndex: number,
    key: string,
    alias: string,
    havingIndex: number,
    having: string,
    fromQuery: string
  ) {
    if (aliasIndex === -1) {
      key = key + ' AS ' + alias;
    } else {
      alias = key.slice(aliasIndex + 4, key.length);
    }

    if (havingIndex !== -1) {
      having = ' ' + fromQuery.slice(havingIndex, fromQuery.length);
      fromQuery = fromQuery.slice(0, havingIndex - 1);
    }
    fromQuery = SqlQueryMacros._applyTimeFilter(fromQuery);
    return [key, alias, having, fromQuery];
  }
  static perSecondColumns(query: string, ast: any): string {
    let [beforeMacrosQuery, fromQuery] = SqlQueryMacros._parseMacro('$perSecondColumns', query);
    if (fromQuery.length < 1) {
      return query;
    }
    let args = ast['$perSecondColumns'];
    if (args.length !== 2) {
      throw {
        message:
          'Amount of arguments must equal 2 for $perSecondColumns func. Parsed arguments are: ' + args.join(', '),
      };
    }

    let key = args[0],
      value = 'max(' + args[1].trim() + ') AS max_0',
      havingIndex = fromQuery.toLowerCase().indexOf('having'),
      having = '',
      aliasIndex = key.toLowerCase().indexOf(' as '),
      alias = 'perSecondColumns';
    [key,
alias,
having,
fromQuery] = SqlQueryMacros._detectAliasAndApplyTimeFilter(
      aliasIndex,
      key,
      alias,
      havingIndex,
      having,
      fromQuery
    );

    return (
      beforeMacrosQuery +
      'SELECT' +
      ' t,' +
      ' groupArray((' +
      alias +
      ', max_0_PerSecond)) AS groupArr' +
      ' FROM (' +
      ' SELECT t,' +
      ' ' +
      alias +
      ', if(runningDifference(max_0) < 0 OR neighbor(' +
      alias +
      ',-1,' +
      alias +
      ') != ' +
      alias +
      ', nan, runningDifference(max_0) / runningDifference(t/1000)) AS max_0_PerSecond' +
      ' FROM (' +
      ' SELECT $timeSeries AS t' +
      ', ' +
      key +
      ', ' +
      value +
      ' ' +
      fromQuery +
      ' GROUP BY t, ' +
      alias +
      having +
      ' ORDER BY ' +
      alias +
      ', t' +
      ')' +
      ')' +
      ' GROUP BY t' +
      ' ORDER BY t'
    );
  }

  static perSecondColumnsAggregated(query: string, ast: any): string {
    const [
      beforeMacrosQuery,
      fromQuery,
      having,
      key,
      keyAlias,
      subKey,
      subKeyAlias,
      values,
      aliases,
      aggFuncs
    ] = SqlQueryMacros._prepareColumnsAggregated('$perSecondColumnsAggregated', query, ast)
    const finalAggregatedValues: string[] = [];
    const finalValues: string[] = [];
    aliases.forEach((a, i) => {
      finalAggregatedValues.push(aggFuncs[i]+"("+a+"PerSecond) AS "+a+"PerSecondAgg");
      finalValues.push("if(runningDifference("+a+") < 0 OR neighbor("+subKeyAlias+",-1,"+subKeyAlias+") != "+subKeyAlias+", nan, runningDifference("+a+") / runningDifference(t / 1000)) AS "+a+"PerSecond");
    });

    return SqlQueryMacros._formatColumnsAggregated(beforeMacrosQuery, keyAlias, finalAggregatedValues, subKeyAlias, finalValues, key, subKey, values, fromQuery, having);
  }

  static increaseColumns(query: string, ast: any): string {
    // return 'Increase 1'
    let [beforeMacrosQuery, fromQuery] = SqlQueryMacros._parseMacro('$increaseColumns', query);
    if (fromQuery.length < 1) {
      return query;
    }
    let args = ast['$increaseColumns'];
    if (args.length !== 2) {
      throw {
        message: 'Amount of arguments must equal 2 for $increaseColumns func. Parsed arguments are: ' + args.join(', '),
      };
    }
    // return 'Increase 2'

    let key = args[0],
      value = 'max(' + args[1].trim() + ') AS max_0',
      havingIndex = fromQuery.toLowerCase().indexOf('having'),
      having = '',
      aliasIndex = key.toLowerCase().indexOf(' as '),
      alias = 'increaseColumns';

    [
      key,
      alias,
      having,
      fromQuery
    ] = SqlQueryMacros._detectAliasAndApplyTimeFilter(
      aliasIndex,
      key,
      alias,
      havingIndex,
      having,
      fromQuery
    );

    return (
      beforeMacrosQuery +
      'SELECT' +
      ' t,' +
      ' groupArray((' +
      alias +
      ', max_0_Increase)) AS groupArr' +
      ' FROM (' +
      ' SELECT t,' +
      ' ' +
      alias +
      ', if(runningDifference(max_0) < 0 OR neighbor(' +
      alias +
      ',-1,' +
      alias +
      ') != ' +
      alias +
      ', 0, runningDifference(max_0)) AS max_0_Increase' +
      ' FROM (' +
      ' SELECT $timeSeries AS t' +
      ', ' +
      key +
      ', ' +
      value +
      ' ' +
      fromQuery +
      ' GROUP BY t, ' +
      alias +
      having +
      ' ORDER BY ' +
      alias +
      ', t' +
      ')' +
      ')' +
      ' GROUP BY t' +
      ' ORDER BY t'
    );
  }

  static increaseColumnsAggregated(query: string, ast: any): string {
    const [
      beforeMacrosQuery,
      fromQuery,
      having,
      key,
      keyAlias,
      subKey,
      subKeyAlias,
      values,
      aliases,
      aggFuncs
    ] = SqlQueryMacros._prepareColumnsAggregated('$increaseColumnsAggregated', query, ast)

    const finalAggregatedValues: string[] = [];
    const finalValues: string[] = [];
    aliases.forEach((a, i) => {
      finalAggregatedValues.push(aggFuncs[i]+"("+a+"Increase) AS "+a+"IncreaseAgg");
      finalValues.push("if(runningDifference("+a+") < 0 OR neighbor("+subKeyAlias+",-1,"+subKeyAlias+") != "+subKeyAlias+", nan, runningDifference("+a+") / 1) AS "+a+"Increase");
    });

    return SqlQueryMacros._formatColumnsAggregated(beforeMacrosQuery, keyAlias, finalAggregatedValues, subKeyAlias, finalValues, key, subKey, values, fromQuery, having);
  }

  static deltaColumns(query: string, ast: any): string {
    let [beforeMacrosQuery, fromQuery] = SqlQueryMacros._parseMacro('$deltaColumns', query);
    if (fromQuery.length < 1) {
      return query;
    }
    let args = ast['$deltaColumns'];
    if (args.length !== 2) {
      throw {
        message: 'Amount of arguments must equal 2 for $deltaColumns func. Parsed arguments are: ' + args.join(', '),
      };
    }

    let key = args[0],
      value = 'max(' + args[1].trim() + ') AS max_0',
      havingIndex = fromQuery.toLowerCase().indexOf('having'),
      having = '',
      aliasIndex = key.toLowerCase().indexOf(' as '),
      alias = 'deltaColumns';
    [
      key,
      alias,
      having,
      fromQuery
    ] = SqlQueryMacros._detectAliasAndApplyTimeFilter(
      aliasIndex,
      key,
      alias,
      havingIndex,
      having,
      fromQuery
    );

    return (
      beforeMacrosQuery +
      'SELECT' +
      ' t,' +
      ' groupArray((' +
      alias +
      ', max_0_Delta)) AS groupArr' +
      ' FROM (' +
      ' SELECT t,' +
      ' ' +
      alias +
      ', if(neighbor(' +
      alias +
      ',-1,' +
      alias +
      ') != ' +
      alias +
      ', 0, runningDifference(max_0)) AS max_0_Delta' +
      ' FROM (' +
      ' SELECT $timeSeries AS t' +
      ', ' +
      key +
      ', ' +
      value +
      ' ' +
      fromQuery +
      ' GROUP BY t, ' +
      alias +
      having +
      ' ORDER BY ' +
      alias +
      ', t' +
      ')' +
      ')' +
      ' GROUP BY t' +
      ' ORDER BY t'
    );
  }

  static deltaColumnsAggregated(query: string, ast: any): string {
    const [
      beforeMacrosQuery,
      fromQuery,
      having,
      key,
      keyAlias,
      subKey,
      subKeyAlias,
      values,
      aliases,
      aggFuncs
    ] = SqlQueryMacros._prepareColumnsAggregated('$deltaColumnsAggregated', query, ast)
    const finalAggregatedValues: string[] = [];
    const finalValues: string[] = [];
    aliases.forEach((a, i) => {
      finalAggregatedValues.push(aggFuncs[i]+"("+a+"Delta) AS "+a+"DeltaAgg");
      finalValues.push("if(neighbor("+subKeyAlias+",-1,"+subKeyAlias+") != "+subKeyAlias+", 0, runningDifference("+a+") / 1) AS "+a+"Delta");
    });

    return SqlQueryMacros._formatColumnsAggregated(beforeMacrosQuery, keyAlias, finalAggregatedValues, subKeyAlias, finalValues, key, subKey, values, fromQuery, having);
  }
  
  static replaceTimeFilters(query: string, range: TimeRange, dateTimeType = TimestampFormat.DateTime, round?: number): string {
    let from = SqlQueryHelper.convertTimestamp(SqlQueryHelper.round(range.from, round || 0));
    let to = SqlQueryHelper.convertTimestamp(SqlQueryHelper.round(range.to, round || 0));

    // Extending date range to be sure that round does not affect first and last points data
    if (round && round > 0) {
      to += round * 2 - 1;
      from -= round * 2 - 1;
    }

    return query
      .replace(
        /\$timeFilterByColumn\(([\w_]+)\)/g,
        (match: string, columnName: string) => `${SqlQueryHelper.getFilterSqlForDateTime(columnName, dateTimeType)}`
      )
      .replace(
        /\$timeFilter64ByColumn\(([\w_]+)\)/g,
        (match: string, columnName: string) => `${SqlQueryHelper.getFilterSqlForDateTime(columnName, TimestampFormat.DateTime64)}`
      )
      .replace(/\$from/g, from.toString())
      .replace(/\$to/g, to.toString())
      .replace(/\$__from/g, range.from.valueOf())
      .replace(/\$__to/g, range.to.valueOf());
  }
}
