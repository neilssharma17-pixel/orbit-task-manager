import { useCallback, useEffect, useMemo, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, isPast, parseISO } from 'date-fns';
import { Activity, ArrowDownUp, CalendarDays, Check, ChevronDown, CircleHelp, Command, Filter, GripVertical, LayoutGrid, ListFilter, LoaderCircle, MoreHorizontal, Plus, Search, Settings2, Sparkles, X } from 'lucide-react';
import { ensureGuestSession, isSupabaseConfigured, supabase, type Priority, type Status, type Task } from './lib';

type Column = { id: Status; title: string; tint: string };
const columns: Column[] = [
  { id: 'todo', title: 'To do', tint: 'slate' },
  { id: 'in_progress', title: 'In progress', tint: 'blue' },
  { id: 'in_review', title: 'In review', tint: 'violet' },
  { id: 'done', title: 'Done', tint: 'green' },
];
const demoTasks: Task[] = [
  { id:'demo-1', title:'Map the first-run experience', description:'Clarify the welcome flow and make the first session feel effortless.', status:'todo', priority:'high', due_date:null, labels:['Product','Design'], user_id:'demo', created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
  { id:'demo-2', title:'Audit component spacing', description:'Review the board, cards, and dialog at tablet breakpoints.', status:'todo', priority:'normal', due_date:null, labels:['Design'], user_id:'demo', created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
  { id:'demo-3', title:'Build task creation modal', description:'Support title, details, priority, labels, and due date.', status:'in_progress', priority:'high', due_date:null, labels:['Product','Frontend'], user_id:'demo', created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
  { id:'demo-4', title:'Connect Supabase session', description:'Create an anonymous session and scope all queries to its user id.', status:'in_progress', priority:'normal', due_date:null, labels:['Backend'], user_id:'demo', created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
  { id:'demo-5', title:'Review empty and error states', description:'Make loading, empty, and retry states feel intentional.', status:'in_review', priority:'low', due_date:null, labels:['Quality'], user_id:'demo', created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
  { id:'demo-6', title:'Set up project foundations', description:'Vite, TypeScript, styling tokens, and repository structure.', status:'done', priority:'normal', due_date:null, labels:['Engineering'], user_id:'demo', created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
];
const labelColors: Record<string,string> = { Product:'mint', Design:'pink', Frontend:'blue', Backend:'amber', Quality:'violet', Engineering:'slate' };

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [demo, setDemo] = useState(!isSupabaseConfigured);
  const [query, setQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [labelFilter, setLabelFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [mobileColumn, setMobileColumn] = useState<Status>('todo');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }));

  const loadTasks = useCallback(async () => {
    if (!supabase || !userId) { setTasks(demoTasks); setLoading(false); return; }
    const { data, error: loadError } = await supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (loadError) throw loadError;
    setTasks((data ?? []) as Task[]);
  }, [userId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!supabase) { if (alive) { setTasks(demoTasks); setLoading(false); } return; }
        const user = await ensureGuestSession();
        if (!alive || !user) return;
        setUserId(user.id);
        const { data, error: loadError } = await supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        if (loadError) throw loadError;
        if (alive) setTasks((data ?? []) as Task[]);
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : 'Something went wrong while loading your workspace.'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredTasks = useMemo(() => tasks.filter(t => {
    const q = query.trim().toLowerCase();
    return (!q || `${t.title} ${t.description} ${t.labels.join(' ')}`.toLowerCase().includes(q)) &&
      (priorityFilter === 'all' || t.priority === priorityFilter) &&
      (labelFilter === 'all' || t.labels.includes(labelFilter));
  }), [tasks, query, priorityFilter, labelFilter]);
  const activeTask = tasks.find(t => t.id === activeId) ?? null;
  const completedCount = tasks.filter(t => t.status === 'done').length;

  async function persist(next: Task[], message?: string) {
    setTasks(next);
    if (demo || !supabase || !userId) { if (message) setToast(message); return; }
    setSaving(true); setError('');
    try {
      const changed = next.find(t => !tasks.some(old => old.id === t.id) || tasks.find(old => old.id === t.id)?.updated_at !== t.updated_at);
      if (changed) {
        const { error: saveError } = await supabase.from('tasks').upsert(changed);
        if (saveError) throw saveError;
      }
      if (message) setToast(message);
    } catch (e) { setError(e instanceof Error ? e.message : 'Your changes could not be saved.'); await loadTasks(); }
    finally { setSaving(false); }
  }

  async function saveTask(input: { title: string; description: string; priority: Priority; due_date: string | null; labels: string[] }) {
    const now = new Date().toISOString();
    const task: Task = editing ? { ...editing, ...input, updated_at: now } : {
      id: crypto.randomUUID(), ...input, status: 'todo', user_id: userId ?? 'demo', created_at: now, updated_at: now,
    };
    const next = editing ? tasks.map(t => t.id === task.id ? task : t) : [task, ...tasks];
    setModalOpen(false); setEditing(null);
    await persist(next, editing ? 'Task updated' : 'Task created');
  }

  async function deleteTask(id: string) {
    const previous = tasks; setTasks(tasks.filter(t => t.id !== id)); setEditing(null); setModalOpen(false);
    if (!demo && supabase) {
      const { error: deleteError } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId);
      if (deleteError) { setTasks(previous); setError(deleteError.message); return; }
    }
    setToast('Task deleted');
  }

  function onDragStart(event: DragStartEvent) { setActiveId(String(event.active.id)); }
  async function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const task = tasks.find(t => t.id === active.id);
    const destination = columns.find(c => c.id === over.id)?.id ?? tasks.find(t => t.id === over.id)?.status;
    if (!task || !destination || task.status === destination) return;
    const moved = { ...task, status: destination, updated_at: new Date().toISOString() };
    const next = tasks.map(t => t.id === task.id ? moved : t);
    await persist(next, `Moved to ${columns.find(c => c.id === destination)?.title}`);
  }

  const allLabels = [...new Set(tasks.flatMap(t => t.labels))].sort();
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><span></span><span></span><span></span></div><span>orbit</span><span className="brand-dot">.</span></div>
      <button className="workspace-switch"><div className="workspace-avatar">N</div><span><b>Neil's workspace</b><small>Personal workspace</small></span><ChevronDown size={15}/></button>
      <div className="side-label">WORKSPACE</div>
      <button className="side-link active"><LayoutGrid size={17}/> Board <span className="side-count">{tasks.length}</span></button>
      <button className="side-link" onClick={() => setToast('Your board is already up to date')}><Activity size={17}/> Activity</button>
      <button className="side-link" onClick={() => { setQuery(''); setPriorityFilter('all'); setLabelFilter('all'); }}><ListFilter size={17}/> All tasks</button>
      <div className="side-label label-spaced">YOUR LABELS <button onClick={() => setToast('Labels can be added from a task editor')}><Plus size={13}/></button></div>
      {allLabels.length ? allLabels.map(label => <button className="side-link label-link" key={label} onClick={() => setLabelFilter(labelFilter === label ? 'all' : label)}><i className={`label-dot ${labelColors[label] ?? 'slate'}`}/>{label}{labelFilter === label && <Check size={14} className="ml-auto"/>}</button>) : <p className="sidebar-hint">Labels you add to tasks will appear here.</p>}
      <div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={15}/></div><b>A little more focus.</b><p>Keep your next move clear and your momentum steady.</p><button onClick={() => setToast('You are right where you need to be')}>Sounds good <span>↗</span></button></div><button className="profile-row"><div className="profile-avatar">NS</div><span><b>Neil Sharma</b><small>{demo ? 'Preview workspace' : 'Guest account'}</small></span><MoreHorizontal size={17}/></button></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <b>Board</b></div><div className="top-actions"><span className={`sync-status ${saving ? 'is-saving' : ''}`}><i/>{saving ? 'Saving' : 'All changes saved'}</span><button className="icon-button" aria-label="Help" onClick={() => setToast('Tip: drag any card to move it between columns')}><CircleHelp size={18}/></button><div className="top-avatar">N</div></div></header>
      <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR SPACE, IN MOTION</div><h1>Project board<span className="heading-period">.</span></h1><p className="subtitle">A clear view of what’s moving, what’s next, and what’s done.</p></div><button className="primary-button" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={17}/> New task</button></section>
      {demo && <div className="demo-banner"><div className="demo-icon"><Sparkles size={15}/></div><div><b>Preview mode</b><span>Explore the board with sample tasks. Connect Supabase to enable private, persistent workspaces.</span></div><button onClick={() => setToast('Add your Supabase URL and anon key to .env.local, then restart the app.')}>Connect Supabase <span>↗</span></button></div>}
      <section className="board-toolbar"><div className="board-summary"><div className="summary-icon"><LayoutGrid size={16}/></div><span><b>All tasks</b><small>{tasks.length} items <span>·</span> {completedCount} completed</small></span></div><div className="toolbar-controls"><div className="search-wrap"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tasks..."/><kbd>⌘ K</kbd></div><div className="filter-wrap"><Filter size={15}/><select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} aria-label="Filter by priority"><option value="all">Priority</option><option value="high">High priority</option><option value="normal">Normal priority</option><option value="low">Low priority</option></select></div><div className="filter-wrap"><ListFilter size={15}/><select value={labelFilter} onChange={e => setLabelFilter(e.target.value)} aria-label="Filter by label"><option value="all">All labels</option>{allLabels.map(l => <option key={l} value={l}>{l}</option>)}</select></div></div></section>
      {error && <div className="error-banner"><span>{error}</span><button onClick={() => { setError(''); loadTasks().catch(e => setError(e.message)); }}>Try again</button><button className="error-close" onClick={() => setError('')}><X size={15}/></button></div>}
      {loading ? <div className="loading-state"><LoaderCircle className="spin" size={25}/><b>Getting your workspace ready</b><span>Just a moment while everything comes together.</span></div> : <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="board-grid">{columns.map(column => <BoardColumn key={column.id} column={column} tasks={filteredTasks.filter(t => t.status === column.id)} onAdd={() => { setEditing(null); setModalOpen(true); }} onEdit={task => { setEditing(task); setModalOpen(true); }}/>)}</div>
        <DragOverlay>{activeTask ? <TaskCard task={activeTask} overlay onEdit={() => {}}/> : null}</DragOverlay>
      </DndContext>}
      <footer className="board-footer"><span><span className="footer-dot"/> Your workspace is private</span><span>Made for thoughtful work <span className="footer-heart">✳</span></span></footer>
    </main>
    {modalOpen && <TaskModal task={editing} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={saveTask} onDelete={deleteTask}/>}
    {toast && <div className="toast"><span className="toast-check"><Check size={13}/></span>{toast}</div>}
  </div>;
}

function BoardColumn({ column, tasks, onAdd, onEdit }: { column: Column; tasks: Task[]; onAdd: () => void; onEdit: (task: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return <section className={`board-column ${isOver ? 'column-over' : ''}`} ref={setNodeRef}>
    <div className="column-heading"><div className="column-title-wrap"><span className={`column-indicator ${column.tint}`}/><h2>{column.title}</h2><span className="task-count">{tasks.length}</span></div><button className="column-menu" aria-label={`${column.title} options`}><MoreHorizontal size={17}/></button></div>
    <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}><div className="task-list">{tasks.map(task => <SortableTask key={task.id} task={task} onEdit={() => onEdit(task)}/>)}</div></SortableContext>
    {tasks.length === 0 && <div className="column-empty"><div className="empty-symbol">＋</div><span>No tasks here yet</span><small>Drop a task or create one</small></div>}
    <button className="add-task-inline" onClick={onAdd}><Plus size={15}/> Add a task</button>
  </section>;
}

function SortableTask({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return <div ref={setNodeRef} style={style} className={isDragging ? 'dragging-card' : ''} {...attributes} {...listeners}><TaskCard task={task} onEdit={onEdit}/></div>;
}

function TaskCard({ task, onEdit, overlay = false }: { task: Task; onEdit: () => void; overlay?: boolean }) {
  const due = task.due_date ? parseISO(task.due_date) : null;
  return <article className={`task-card ${overlay ? 'task-card-overlay' : ''}`} onClick={onEdit}>
    <div className="card-topline"><span className={`priority-pill ${task.priority}`}><i/>{task.priority === 'high' ? 'High' : task.priority === 'low' ? 'Low' : 'Normal'}</span><button className="card-grip" aria-label="Drag task"><GripVertical size={15}/></button></div>
    <h3>{task.title}</h3>{task.description && <p className="card-description">{task.description}</p>}
    {task.labels.length > 0 && <div className="card-labels">{task.labels.map(label => <span key={label} className={`task-label ${labelColors[label] ?? 'slate'}`}>{label}</span>)}</div>}
    <div className="card-bottom"><div className="card-meta">{due && <span className={`due-date ${isPast(due) && task.status !== 'done' ? 'overdue' : ''}`}><CalendarDays size={13}/>{format(due, 'MMM d')}</span>}</div><div className="assignee-avatar">NS</div></div>
  </article>;
}

function TaskModal({ task, onClose, onSave, onDelete }: { task: Task | null; onClose: () => void; onSave: (v: { title: string; description: string; priority: Priority; due_date: string | null; labels: string[] }) => void; onDelete: (id: string) => void }) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'normal');
  const [dueDate, setDueDate] = useState(task?.due_date ?? '');
  const [labels, setLabels] = useState(task?.labels.join(', ') ?? '');
  const [validation, setValidation] = useState('');
  function submit(e: React.FormEvent) { e.preventDefault(); if (!title.trim()) { setValidation('Give this task a title to continue.'); return; } onSave({ title: title.trim(), description: description.trim(), priority, due_date: dueDate || null, labels: labels.split(',').map(x => x.trim()).filter(Boolean).slice(0, 6) }); }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><form className="task-modal" onSubmit={submit}>
    <div className="modal-heading"><div><span className="modal-kicker">TASK DETAILS</span><h2>{task ? 'Edit task' : 'Create a task'}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18}/></button></div>
    <label className="field-label">Task name <span>Required</span><input autoFocus maxLength={160} value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to get done?"/></label>
    <label className="field-label">Description <span>Optional</span><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Add a little context, a link, or the next step..."/></label>
    <div className="field-row"><label className="field-label">Priority<select value={priority} onChange={e => setPriority(e.target.value as Priority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label><label className="field-label">Due date<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}/></label></div>
    <label className="field-label">Labels <span>Separate with commas</span><input value={labels} onChange={e => setLabels(e.target.value)} placeholder="Design, Frontend, Research"/></label>
    {validation && <p className="validation-message">{validation}</p>}
    <div className="modal-footer">{task && <button type="button" className="delete-button" onClick={() => onDelete(task.id)}>Delete task</button>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">{task ? 'Save changes' : 'Create task'}</button></div></div>
  </form></div>;
}

export default App;
