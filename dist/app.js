(() => {
  'use strict';

  const pages = [...document.querySelectorAll('.page')];
  const prev = document.querySelector('[data-prev]');
  const nextButtons = [...document.querySelectorAll('[data-next]')];
  const chapter = document.querySelector('.chapter-label');
  const current = document.querySelector('.page-current');
  const total = document.querySelector('.page-total');
  const progress = document.querySelector('.progress-track i');
  const dots = document.querySelector('.chapter-dots');
  const stage = document.querySelector('.book-stage');
  let index = 0;
  let touchStartX = 0;

  total.textContent = String(pages.length).padStart(2, '0');
  pages.forEach((page, pageIndex) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'chapter-dot';
    dot.setAttribute('aria-label', `前往${page.dataset.title}`);
    dot.addEventListener('click', () => showPage(pageIndex));
    dots.append(dot);
  });

  function syncNavigation() {
    current.textContent = String(index + 1).padStart(2, '0');
    chapter.textContent = pages[index].dataset.title;
    progress.style.width = `${((index + 1) / pages.length) * 100}%`;
    prev.disabled = index === 0;
    nextButtons.forEach((button) => { button.disabled = index === pages.length - 1; });
    [...dots.children].forEach((dot, dotIndex) => {
      if (dotIndex === index) dot.setAttribute('aria-current', 'page');
      else dot.removeAttribute('aria-current');
    });
  }

  function showPage(target, updateHash = true) {
    if (!Number.isInteger(target) || target < 0 || target >= pages.length || target === index) return;
    const old = pages[index];
    const goingBack = target < index;
    old.classList.toggle('is-leaving-back', goingBack);
    old.classList.add('is-leaving');
    old.classList.remove('is-active');
    old.setAttribute('aria-hidden', 'true');
    index = target;
    pages[index].classList.add('is-active');
    pages[index].setAttribute('aria-hidden', 'false');
    pages[index].scrollTop = 0;
    window.setTimeout(() => old.classList.remove('is-leaving', 'is-leaving-back'), 820);
    if (updateHash) history.replaceState(null, '', `#${pages[index].id}`);
    syncNavigation();
  }

  prev.addEventListener('click', () => showPage(index - 1));
  nextButtons.forEach((button) => button.addEventListener('click', () => showPage(index + 1)));
  document.querySelectorAll('[data-goto]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      showPage(Number(button.dataset.goto));
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.target.matches('input, select, textarea, button')) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') showPage(index + 1);
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') showPage(index - 1);
  });
  stage.addEventListener('touchstart', (event) => {
    if (event.target.closest('input, select, button, label, a')) return;
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });
  stage.addEventListener('touchend', (event) => {
    if (!touchStartX || event.target.closest('input, select, button, label, a')) return;
    const delta = event.changedTouches[0].clientX - touchStartX;
    touchStartX = 0;
    if (Math.abs(delta) > 60) showPage(index + (delta < 0 ? 1 : -1));
  }, { passive: true });

  const initialHash = location.hash.slice(1);
  const initialIndex = pages.findIndex((page) => page.id === initialHash);
  if (initialIndex > 0) showPage(initialIndex, false);
  else syncNavigation();

  const soundButton = document.querySelector('.sound-toggle');
  let audioContext;
  let ambientSource;
  let ambientGain;
  function startAmbience() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    audioContext ||= new AudioContext();
    const frameCount = audioContext.sampleRate * 3;
    const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    let smooth = 0;
    for (let i = 0; i < frameCount; i += 1) {
      smooth = smooth * .985 + (Math.random() * 2 - 1) * .015;
      data[i] = smooth * .65;
    }
    ambientSource = audioContext.createBufferSource();
    ambientSource.buffer = buffer;
    ambientSource.loop = true;
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 720;
    ambientGain = audioContext.createGain();
    ambientGain.gain.value = 0;
    ambientSource.connect(filter).connect(ambientGain).connect(audioContext.destination);
    ambientSource.start();
    ambientGain.gain.linearRampToValueAtTime(.16, audioContext.currentTime + .8);
    return true;
  }
  soundButton.addEventListener('click', async () => {
    const isOn = soundButton.getAttribute('aria-pressed') === 'true';
    if (!audioContext || !ambientSource) startAmbience();
    if (audioContext?.state === 'suspended') await audioContext.resume();
    if (!ambientGain) return;
    ambientGain.gain.cancelScheduledValues(audioContext.currentTime);
    ambientGain.gain.linearRampToValueAtTime(isOn ? 0 : .16, audioContext.currentTime + .35);
    soundButton.setAttribute('aria-pressed', String(!isOn));
    soundButton.setAttribute('aria-label', isOn ? '開啟海浪環境音' : '關閉海浪環境音');
  });

  const STORAGE_KEY = 'xiaoliuqiu-trip-split-v1';
  const defaultState = () => ({
    members: [
      { id: 'tainan', name: '台南出發' },
      { id: 'kaohsiung', name: '高雄上車' },
    ],
    expenses: [],
    packing: {},
  });
  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (stored && Array.isArray(stored.members) && Array.isArray(stored.expenses)) return { ...defaultState(), ...stored };
    } catch (_) { /* Ignore invalid local data and start clean. */ }
    return defaultState();
  }
  let tripState = loadState();
  tripState.packing ||= {};
  const memberForm = document.querySelector('#member-form');
  const memberName = document.querySelector('#member-name');
  const memberChips = document.querySelector('#member-chips');
  const expenseForm = document.querySelector('#expense-form');
  const payerSelect = document.querySelector('#payer-select');
  const participantGrid = document.querySelector('#participant-grid');
  const formMessage = document.querySelector('#form-message');
  const totalOutput = document.querySelector('#trip-total');
  const balanceList = document.querySelector('#balance-list');
  const settlementList = document.querySelector('#settlement-list');
  const settlementCount = document.querySelector('#settlement-count');
  const expenseList = document.querySelector('#expense-list');
  const expenseCount = document.querySelector('#expense-count');

  function uniqueId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }
  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tripState));
  }
  function money(cents) {
    const value = cents / 100;
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency', currency: 'TWD', minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2,
    }).format(value);
  }
  function getMember(id) {
    return tripState.members.find((member) => member.id === id);
  }
  function calculate() {
    const balances = Object.fromEntries(tripState.members.map((member) => [member.id, 0]));
    let totalCents = 0;
    tripState.expenses.forEach((expense) => {
      const cents = Math.round(Number(expense.amount) * 100);
      const participants = expense.participants.filter((id) => id in balances);
      if (!participants.length || !(expense.payer in balances)) return;
      totalCents += cents;
      balances[expense.payer] += cents;
      const baseShare = Math.floor(cents / participants.length);
      let remainder = cents - baseShare * participants.length;
      participants.forEach((id) => {
        balances[id] -= baseShare + (remainder > 0 ? 1 : 0);
        remainder -= remainder > 0 ? 1 : 0;
      });
    });
    const creditors = Object.entries(balances).filter(([, amount]) => amount > 0).map(([id, amount]) => ({ id, amount })).sort((a, b) => b.amount - a.amount);
    const debtors = Object.entries(balances).filter(([, amount]) => amount < 0).map(([id, amount]) => ({ id, amount: -amount })).sort((a, b) => b.amount - a.amount);
    const settlements = [];
    let c = 0;
    let d = 0;
    while (c < creditors.length && d < debtors.length) {
      const amount = Math.min(creditors[c].amount, debtors[d].amount);
      if (amount > 0) settlements.push({ from: debtors[d].id, to: creditors[c].id, amount });
      creditors[c].amount -= amount;
      debtors[d].amount -= amount;
      if (creditors[c].amount === 0) c += 1;
      if (debtors[d].amount === 0) d += 1;
    }
    return { totalCents, balances, settlements };
  }

  function renderMemberControls() {
    const selected = new Set([...participantGrid.querySelectorAll('input:checked')].map((input) => input.value));
    const payer = payerSelect.value;
    memberChips.replaceChildren();
    payerSelect.replaceChildren();
    participantGrid.replaceChildren();
    tripState.members.forEach((member) => {
      const chip = document.createElement('span');
      chip.className = 'member-chip';
      chip.append(document.createTextNode(member.name));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `移除${member.name}`);
      remove.disabled = tripState.members.length === 1;
      remove.addEventListener('click', () => removeMember(member.id));
      chip.append(remove);
      memberChips.append(chip);

      const option = document.createElement('option');
      option.value = member.id;
      option.textContent = member.name;
      if (member.id === payer) option.selected = true;
      payerSelect.append(option);

      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'participants';
      checkbox.value = member.id;
      checkbox.checked = selected.size ? selected.has(member.id) : true;
      const name = document.createElement('span');
      name.textContent = member.name;
      label.append(checkbox, name);
      participantGrid.append(label);
    });
  }

  function renderResults() {
    const { totalCents, balances, settlements } = calculate();
    totalOutput.textContent = money(totalCents);
    balanceList.replaceChildren();
    tripState.members.forEach((member) => {
      const value = balances[member.id] || 0;
      const card = document.createElement('div');
      card.className = `balance-card${value < 0 ? ' is-owing' : ''}`;
      const label = document.createElement('span');
      label.textContent = member.name;
      const amount = document.createElement('b');
      amount.textContent = value === 0 ? '已平衡' : `${value > 0 ? '收 ' : '付 '}${money(Math.abs(value))}`;
      card.append(label, amount);
      balanceList.append(card);
    });

    settlementList.replaceChildren();
    settlementCount.textContent = `${settlements.length} 筆`;
    if (!settlements.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = tripState.expenses.length ? '目前沒有需要轉帳的差額。' : '新增支出後，這裡會自動算出誰要轉給誰。';
      settlementList.append(empty);
    } else {
      settlements.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'settlement-row';
        const from = document.createElement('span');
        from.textContent = getMember(item.from)?.name || '已移除成員';
        const arrow = document.createElement('i');
        arrow.textContent = '→';
        const to = document.createElement('span');
        to.textContent = getMember(item.to)?.name || '已移除成員';
        const amount = document.createElement('b');
        amount.textContent = money(item.amount);
        row.append(from, arrow, to, amount);
        settlementList.append(row);
      });
    }

    expenseList.replaceChildren();
    expenseCount.textContent = `${tripState.expenses.length} 筆`;
    if (!tripState.expenses.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = '還沒有支出。船票、住宿、機車與餐費都可以記在這裡。';
      expenseList.append(empty);
    } else {
      [...tripState.expenses].reverse().forEach((expense) => {
        const row = document.createElement('div');
        row.className = 'expense-row';
        const info = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = expense.title;
        const detail = document.createElement('small');
        detail.textContent = `${expense.category} · ${getMember(expense.payer)?.name || '已移除成員'}先付 · ${expense.participants.length}人分`;
        info.append(title, detail);
        const amount = document.createElement('b');
        amount.textContent = money(Math.round(expense.amount * 100));
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '×';
        remove.setAttribute('aria-label', `刪除${expense.title}`);
        remove.addEventListener('click', () => {
          tripState.expenses = tripState.expenses.filter((item) => item.id !== expense.id);
          persist();
          renderResults();
        });
        row.append(info, amount, remove);
        expenseList.append(row);
      });
    }
  }

  function renderAll() {
    renderMemberControls();
    renderResults();
  }
  function removeMember(id) {
    if (tripState.members.length === 1) return;
    if (tripState.expenses.some((expense) => expense.payer === id || expense.participants.includes(id))) {
      formMessage.textContent = '這位旅伴已經有支出紀錄，請先刪除相關明細。';
      return;
    }
    tripState.members = tripState.members.filter((member) => member.id !== id);
    persist();
    renderAll();
  }
  function addExpense({ title, amount, payer, participants, category = '其他' }) {
    const numericAmount = Number(amount);
    if (!title?.trim()) throw new Error('請輸入支出項目。');
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('金額必須大於 0。');
    if (!tripState.members.some((member) => member.id === payer)) throw new Error('請選擇付款人。');
    const validParticipants = [...new Set(participants)].filter((id) => tripState.members.some((member) => member.id === id));
    if (!validParticipants.length) throw new Error('至少選擇一位分攤成員。');
    const expense = { id: uniqueId('expense'), title: title.trim(), amount: Math.round(numericAmount), payer, participants: validParticipants, category };
    tripState.expenses.push(expense);
    persist();
    renderResults();
    return expense;
  }

  memberForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = memberName.value.trim();
    if (!name) return;
    if (tripState.members.some((member) => member.name.toLowerCase() === name.toLowerCase())) {
      formMessage.textContent = '這個名稱已經在旅伴清單裡。';
      return;
    }
    tripState.members.push({ id: uniqueId('member'), name });
    memberName.value = '';
    formMessage.textContent = '';
    persist();
    renderAll();
  });
  expenseForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(expenseForm);
    try {
      addExpense({
        title: data.get('title'),
        amount: data.get('amount'),
        category: data.get('category'),
        payer: data.get('payer'),
        participants: data.getAll('participants'),
      });
      expenseForm.querySelector('[name="title"]').value = '';
      expenseForm.querySelector('[name="amount"]').value = '';
      formMessage.textContent = '已加入支出並重新計算。';
      formMessage.classList.add('success');
      window.setTimeout(() => { formMessage.textContent = ''; formMessage.classList.remove('success'); }, 2200);
    } catch (error) {
      formMessage.classList.remove('success');
      formMessage.textContent = error.message;
    }
  });

  function summaryText() {
    const { totalCents, settlements } = calculate();
    const lines = [`小琉球 9/25–9/26 分帳`, `總支出：${money(totalCents)}`, ''];
    if (!settlements.length) lines.push('目前沒有需要轉帳的差額。');
    settlements.forEach((item) => lines.push(`${getMember(item.from)?.name} → ${getMember(item.to)?.name}：${money(item.amount)}`));
    return lines.join('\n');
  }
  document.querySelector('#copy-summary').addEventListener('click', async (event) => {
    const text = summaryText();
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    const button = event.currentTarget;
    const original = button.textContent;
    button.textContent = '已複製';
    window.setTimeout(() => { button.textContent = original; }, 1500);
  });
  document.querySelector('#clear-trip').addEventListener('click', () => {
    if (!window.confirm('確定要清空所有旅伴與支出嗎？此動作無法復原。')) return;
    tripState = defaultState();
    persist();
    renderAll();
  });

  document.querySelectorAll('[data-pack]').forEach((checkbox) => {
    checkbox.checked = Boolean(tripState.packing[checkbox.dataset.pack]);
    checkbox.addEventListener('change', () => {
      tripState.packing[checkbox.dataset.pack] = checkbox.checked;
      persist();
    });
  });

  function registerWebMcp() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const memberNames = () => tripState.members.map((member) => member.name);
    const idFromName = (name) => tripState.members.find((member) => member.name === name)?.id;
    try {
      void Promise.resolve(context.registerTool({
        name: 'add_trip_expense',
        title: '新增小琉球旅費',
        description: '在目前的小琉球分帳中新增一筆支出，指定付款人與分攤成員。',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1 },
            amount: { type: 'number', exclusiveMinimum: 0 },
            category: { type: 'string' },
            payerName: { type: 'string' },
            participantNames: { type: 'array', items: { type: 'string' }, minItems: 1 },
          },
          required: ['title', 'amount', 'payerName', 'participantNames'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (!input || typeof input !== 'object') throw new Error('輸入格式不正確。');
          const payer = idFromName(input.payerName);
          const participants = input.participantNames.map(idFromName).filter(Boolean);
          if (!payer) throw new Error(`找不到付款人。可用成員：${memberNames().join('、')}`);
          if (participants.length !== input.participantNames.length) throw new Error(`有分攤成員不存在。可用成員：${memberNames().join('、')}`);
          const expense = addExpense({ title: input.title, amount: input.amount, category: input.category || '其他', payer, participants });
          return { id: expense.id, total: calculate().totalCents / 100 };
        },
      })).catch(() => {});
      void Promise.resolve(context.registerTool({
        name: 'get_trip_split_summary',
        title: '讀取分帳摘要',
        description: '讀取目前的旅伴、總支出與建議轉帳，不修改資料。',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute() {
          const result = calculate();
          return {
            members: memberNames(),
            total: result.totalCents / 100,
            settlements: result.settlements.map((item) => ({ from: getMember(item.from)?.name, to: getMember(item.to)?.name, amount: item.amount / 100 })),
          };
        },
      })).catch(() => {});
    } catch (_) { /* Experimental API may reject registration; visible UI remains fully functional. */ }
  }

  renderAll();
  registerWebMcp();
  window.__tripSplit = { calculate, addExpense, getState: () => structuredClone(tripState) };
})();
