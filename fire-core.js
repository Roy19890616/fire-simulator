/*
 * 財務自由模擬器：計算核心
 * 邏輯對應原 Excel（2026-10-07 研究，詳見 tasks/todo.md）
 *  - 生活開銷：第 0 年 = 月生活費 × 12，之後每年 × (1 + 通膨率)
 *  - 投資總價值：年回報率 / 派息次數 為每期利率，每期期末投入 (每月投資 × 12 / 派息次數)
 *    （派息次數 = 1 時與 Excel 的 -FV() 完全一致；>1 時修正 Excel 原本少算期數的問題）
 *  - 每年投資回報 = 投資總價值 × 年回報率；第 0 年為 0
 *  - 財務自由 = 投資回報 > 生活開銷 的第一年
 *  - 退休後：停止追加投資；生活開銷 = 退休前一年 × (1 − 減少比例) × (1 + 通膨率)，之後逐年通膨
 *    剩餘 = 年初值 + 年初值 × 退休後回報率 − 生活開銷（退休次年開始扣，同 Excel）
 */
(function (root) {
  'use strict';

  var END_AGE = 90;

  function simulate(p) {
    var r = p.annualReturn;
    var n = Math.max(1, Math.round(p.payoutsPerYear || 1));
    var i = p.inflation;
    var baseExpense = p.monthlyExpense * 12;

    function expenseAt(age) {
      return baseExpense * Math.pow(1 + i, age - p.age);
    }
    function valueAfter(k) {
      var rp = r / n, periods = n * k, pmt = p.monthlyInvest * 12 / n;
      var g = Math.pow(1 + rp, periods);
      var annuity = rp === 0 ? periods : (g - 1) / rp;
      return p.initialInvest * g + pmt * annuity;
    }

    // 累積期：顯示到「退休年齡」與「起始＋30 年」較晚者，最多 90 歲（Excel 固定 30 年）
    var lastAge = Math.min(END_AGE, Math.max(p.retireAge, p.age + 30));
    var accum = [];
    var fire = null;
    for (var age = p.age; age <= lastAge; age++) {
      var k = age - p.age;
      var value = valueAfter(k);
      var ret = k === 0 ? 0 : value * r;
      var exp = expenseAt(age);
      var ok = ret > exp;
      accum.push({
        age: age, index: k, year: p.startYear + k,
        cost: p.initialInvest + p.monthlyInvest * 12 * k,
        value: value, expense: exp, income: ret, fire: ok
      });
      if (ok && !fire) fire = { age: age, year: p.startYear + k };
    }

    // 退休期
    var R = p.retireAge;
    var startValue = valueAfter(R - p.age);
    var retire = [{
      age: R, index: 0, year: p.startYear + (R - p.age),
      start: null, income: null, expense: null, remain: startValue, ok: startValue > 0
    }];
    var exp2 = expenseAt(R - 1) * (1 - p.retireCut) * (1 + i);
    var bal = startValue, depleted = null, sumExp = 0, cnt = 0;
    for (var a = R + 1; a <= END_AGE; a++) {
      exp2 = exp2 * (1 + i);
      var inc = bal * p.retireReturn;
      var remain = bal + inc - exp2;
      retire.push({
        age: a, index: a - R, year: p.startYear + (a - p.age),
        start: bal, income: inc, expense: exp2, remain: remain, ok: remain > 0
      });
      if (remain <= 0 && depleted === null) depleted = a;
      sumExp += exp2; cnt++;
      bal = remain;
    }

    return {
      accum: accum,
      fire: fire,
      retire: retire,
      retireStartValue: startValue,
      finalValue: bal,
      depletedAge: depleted,
      avgRetireExpense: cnt ? sumExp / cnt : 0,
      endAge: END_AGE
    };
  }

  var api = { simulate: simulate, END_AGE: END_AGE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FireCore = api;
})(this);
