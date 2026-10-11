import { FlaskConical, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import type { CodeMapping, OperatingCalendar, Parameter, Sku, Vendor } from '@/data/types'
import type { Dataset } from '@/data/dataset'
import { AssumptionNote, Badge, Button, Callout, Card, CellText, Drawer, EmptyState, HelpTip, IconButton, LocalFilters, Loading, PageHeader, Pager, Select, TableWrap, cx, td, tdNum, th } from '@/components/ui'
import { fmtDate, fmtDow } from '@/lib/dates'
import { usePageFilters } from '@/lib/filters'
import { fmtNum } from '@/lib/format'
import { useAppState, useDataset, usePermissions } from '@/lib/store'
import { MASTER_SECTIONS, masterPath, type MasterSection } from '@/app/nav'
import { HierarchyTab } from './HierarchyTab'
import { CalExceptionModal, CalendarModal, CodeMappingModal, ParamModal, SkuModal, VendorModal } from './MasterForms'
import { ActivityRows, SearchBox, saveMaster, useConfirm, usePaged } from './shared'

const VendorSkuList = lazy(() => import('./VendorSkuList'))
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const SUBTITLE: Record<MasterSection, string> = {
  'product-hierarchy': 'Categories, brands and FG SKUs with their attributes',
  vendors: 'Contract manufacturers and the SKUs they produce',
  'uom-conversions': 'Case packs and weights used to convert between EA, CS and MT',
  'operating-calendars': 'Weekly operating patterns assigned to vendors. Non-operating days show as “Non-operating day”, never as missing or zero.',
  'calendar-exceptions': 'Holidays, shutdowns and extra working days that override the weekly pattern',
  'code-mappings': 'Translate vendor item codes in incoming reports to FG codes. Unmapped codes are excluded at upload with a warning.',
  parameters: 'Thresholds used by statuses and exception rules. All are provisional pending business confirmation.',
  'change-history': 'Local demo log of every master data change made in this browser',
}

// Primary “Add …” page action per section (shown only to personas that can edit).
const ADD_LABEL: Partial<Record<MasterSection, string>> = {
  vendors: 'Add vendor',
  'operating-calendars': 'Add calendar',
  'calendar-exceptions': 'Add exception',
  'code-mappings': 'Add mapping',
}

export default function MasterData() {
  usePageFilters([])
  const ds = useDataset()
  const { can } = usePermissions()
  const canEdit = can('masterData.edit')
  const [adding, setAdding] = useState<MasterSection | null>(null)
  // The section lives in the URL (/master-data/<slug>); the sidebar is the section navigation.
  const { section } = useParams()
  const current = MASTER_SECTIONS.find((m) => m.slug === section)
  if (!current) return <Navigate to={masterPath(MASTER_SECTIONS[0].slug)} replace />
  const tab = current.slug

  return (
    <div>
      <PageHeader
        back={
          <nav aria-label="Breadcrumb" className="mb-1">
            <ol className="flex items-center gap-1 text-label text-ink-subtle">
              <li>Master Data</li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-ink-muted">
                {current.label}
              </li>
            </ol>
          </nav>
        }
        title={current.label}
        subtitle={SUBTITLE[tab]}
        actions={
          <>
            {!canEdit && (
              <Badge tone="none" icon={Lock}>
                Read-only for this persona
              </Badge>
            )}
            {canEdit && ADD_LABEL[tab] && (
              <Button variant="primary" icon={Plus} onClick={() => setAdding(tab)}>
                {ADD_LABEL[tab]}
              </Button>
            )}
          </>
        }
      >
        <div className="mt-2 flex items-center gap-1 text-dense text-ink-muted">
          <FlaskConical size={14} className="shrink-0 text-ink-subtle" aria-hidden />
          Demo changes are saved in this browser only
          <HelpTip label="About demo changes">
            Edits are stored only in this browser for the demo and immediately recalculate the demo dataset. Nothing is written to any GCPL system, and other people and browsers do not see your changes. Use “Reset demo” in the top bar to
            restore the original fixtures.
          </HelpTip>
        </div>
      </PageHeader>
      {tab === 'product-hierarchy' && <HierarchyTab ds={ds} canEdit={canEdit} />}
      {tab === 'vendors' && <VendorsTab ds={ds} canEdit={canEdit} />}
      {tab === 'uom-conversions' && <UomTab ds={ds} canEdit={canEdit} />}
      {tab === 'operating-calendars' && <CalendarsTab ds={ds} canEdit={canEdit} />}
      {tab === 'calendar-exceptions' && <CalExTab ds={ds} canEdit={canEdit} />}
      {tab === 'code-mappings' && <CodesTab ds={ds} canEdit={canEdit} />}
      {tab === 'parameters' && <ParamsTab ds={ds} canEdit={canEdit} />}
      {tab === 'change-history' && <HistoryTab />}
      {adding === 'vendors' && <VendorModal ds={ds} vendor={null} onClose={() => setAdding(null)} />}
      {adding === 'operating-calendars' && <CalendarModal ds={ds} cal={null} onClose={() => setAdding(null)} />}
      {adding === 'calendar-exceptions' && <CalExceptionModal ds={ds} onClose={() => setAdding(null)} />}
      {adding === 'code-mappings' && <CodeMappingModal ds={ds} mapping={null} onClose={() => setAdding(null)} />}
    </div>
  )
}

function VendorsTab({ ds, canEdit }: { ds: Dataset; canEdit: boolean }) {
  const [edit, setEdit] = useState<Vendor | null>(null)
  const [q, setQ] = useState('')
  const [skuVendor, setSkuVendor] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const needle = q.trim().toLowerCase()
  const rows = needle ? ds.vendors.filter((v) => [v.name, v.code, v.location].some((x) => x.toLowerCase().includes(needle))) : ds.vendors
  const drawerVendor = skuVendor ? ds.idx.vendor.get(skuVendor) : undefined
  const closeDrawer = useCallback(() => setSkuVendor(null), [])
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SearchBox inputRef={searchRef} className="w-[320px] max-w-full" value={q} onChange={setQ} label="Search vendors" placeholder="Search vendors by name, code or location" />
        <p className="text-dense text-ink-muted" aria-live="polite">
          {needle ? `${rows.length} of ${ds.vendors.length} vendors` : `${ds.vendors.length} vendors`}
        </p>
      </div>
      <Card bodyClass="p-0">
        {rows.length === 0 ? (
          needle ? (
            <EmptyState
              title={`No vendors match “${q.trim()}”`}
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setQ('')
                    searchRef.current?.focus()
                  }}
                >
                  Reset search
                </Button>
              }
            >
              Search looks at vendor name, code and location.
            </EmptyState>
          ) : (
            <EmptyState title="No vendors yet">{canEdit ? 'Use “Add vendor” to create the first one.' : 'Vendors appear here once they are added.'}</EmptyState>
          )
        ) : (
          <TableWrap>
            <table className="w-full border-separate border-spacing-0">
              <caption className="sr-only">Vendors</caption>
              <thead>
                <tr>
                  <th className={th}>Vendor</th>
                  <th className={th}>Code</th>
                  <th className={th}>Location</th>
                  <th className={th}>Calendar</th>
                  <th className={th}>Report sender (demo)</th>
                  <th className={cx(th, 'text-right')}>SKUs</th>
                  {canEdit && (
                    <th className={th}>
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => {
                  const n = ds.idx.vendorSkus.get(v.id)?.length ?? 0
                  const cal = ds.calendars.find((c) => c.id === v.calendarId)?.name ?? v.calendarId
                  return (
                    <tr key={v.id} className="hover:bg-surface-muted/60">
                      <td className={cx(td, 'font-medium whitespace-nowrap text-ink')}>{v.name}</td>
                      <td className={cx(td, 'font-mono text-label text-ink-subtle')}>{v.code}</td>
                      <td className={cx(td, 'text-ink-muted')}>
                        <CellText text={v.location} className="max-w-[200px]" />
                      </td>
                      <td className={cx(td, 'text-ink-muted')}>
                        <CellText text={cal} className="max-w-[170px]" />
                      </td>
                      <td className={cx(td, 'text-ink-muted')}>
                        <CellText text={v.reportEmail} className="max-w-[190px]" />
                      </td>
                      <td className={cx(tdNum, 'py-0')}>
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          aria-label={`${n} SKU${n === 1 ? '' : 's'} for ${v.name}: view relationships`}
                          onClick={() => setSkuVendor(v.id)}
                          className="num inline-flex h-7 min-w-8 items-center justify-end rounded px-1.5 font-medium text-accent-ink underline decoration-accent/40 underline-offset-2 hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          {n}
                        </button>
                      </td>
                      {canEdit && (
                        <td className={cx(td, 'w-px py-0')}>
                          <IconButton icon={Pencil} label={`Edit ${v.name}`} onClick={() => setEdit(v)} />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      <Drawer open={!!drawerVendor} onClose={closeDrawer} width={640} title={drawerVendor?.name ?? ''} subtitle={drawerVendor && `${drawerVendor.code} · ${drawerVendor.location} · SKU relationships`}>
        {drawerVendor && (
          <Suspense fallback={<Loading label="Loading SKU relationships…" />}>
            <VendorSkuList ds={ds} vendorId={drawerVendor.id} canEdit={canEdit} />
          </Suspense>
        )}
      </Drawer>
      {edit && <VendorModal ds={ds} vendor={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function UomTab({ ds, canEdit }: { ds: Dataset; canEdit: boolean }) {
  const [edit, setEdit] = useState<Sku | null>(null)
  const noWeight = ds.skus.filter((s) => s.kgPerEa == null)
  return (
    <div className="space-y-3">
      <AssumptionNote>EA ↔ CS always goes through the SKU case pack. MT is computed only where a kg/EA weight exists; SKUs without one are excluded from MT totals and listed as exclusions.</AssumptionNote>
      {noWeight.length > 0 && (
        <Callout tone="warn" title={`${noWeight.length} SKU(s) have no weight conversion`}>
          {noWeight.map((s) => `${s.code} ${s.name}`).join(' · ')} – excluded from MT views.
        </Callout>
      )}
      <Card bodyClass="p-0" title="FG conversions" subtitle="Per-SKU conversion factors">
        <TableWrap maxHeight={480}>
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={th}>SKU</th>
                <th className={cx(th, 'text-right')}>EA per CS</th>
                <th className={cx(th, 'text-right')}>kg per EA</th>
                <th className={cx(th, 'text-right')}>EA per MT</th>
                <th className={th}>MT available</th>
                {canEdit && (
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {ds.skus.map((s) => (
                <tr key={s.code} className="hover:bg-surface-muted/60">
                  <td className={td}>
                    {s.name} <span className="font-mono text-label text-ink-subtle">{s.code}</span>
                  </td>
                  <td className={tdNum}>{fmtNum(s.casePack)}</td>
                  <td className={tdNum}>{s.kgPerEa != null ? fmtNum(s.kgPerEa, 3) : '—'}</td>
                  <td className={tdNum}>{s.kgPerEa ? fmtNum(1000 / s.kgPerEa) : '—'}</td>
                  <td className={td}>{s.kgPerEa != null ? <Badge tone="ok">Yes</Badge> : <Badge tone="warn">No – excluded from MT</Badge>}</td>
                  {canEdit && (
                    <td className={td}>
                      <IconButton icon={Pencil} label={`Edit conversion for ${s.code}`} onClick={() => setEdit(s)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
      <Card bodyClass="p-0" title="RM / PM materials" subtitle="Materials keep their own reporting UOM. FG case packs and weights are never applied to materials, and different UOMs are never summed.">
        <TableWrap maxHeight={360}>
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={th}>Material</th>
                <th className={th}>Type</th>
                <th className={th}>UOM</th>
                <th className={th}>Used in SKUs</th>
              </tr>
            </thead>
            <tbody>
              {ds.materials.map((m) => (
                <tr key={m.code}>
                  <td className={td}>
                    {m.name} <span className="font-mono text-label text-ink-subtle">{m.code}</span>
                  </td>
                  <td className={td}>{m.kind === 'RM' ? 'RM' : 'PM'}</td>
                  <td className={cx(td, 'font-mono text-dense')}>{m.uom}</td>
                  <td className={cx(td, 'font-mono text-label text-ink-subtle')}>{m.usedInSkus.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
      {edit && <SkuModal ds={ds} sku={edit} uomOnly onClose={() => setEdit(null)} />}
    </div>
  )
}

function CalendarsTab({ ds, canEdit }: { ds: Dataset; canEdit: boolean }) {
  const [edit, setEdit] = useState<OperatingCalendar | null>(null)
  return (
    <Card bodyClass="p-0">
      <TableWrap>
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={th}>Calendar</th>
              <th className={th}>Weekly off</th>
              <th className={th}>2nd Saturday</th>
              <th className={th}>Vendors</th>
              <th className={cx(th, 'text-right')}>Exceptions</th>
              {canEdit && (
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {ds.calendars.map((c) => (
              <tr key={c.id} className="hover:bg-surface-muted/60">
                <td className={td}>
                  <div className="font-medium">{c.name}</div>
                  <div className="font-mono text-label text-ink-subtle">{c.id}</div>
                </td>
                <td className={td}>{c.weeklyOff.map((d) => DOW[d]).join(', ') || 'None'}</td>
                <td className={td}>{c.offSecondSaturday ? <Badge tone="info">Off</Badge> : 'Working'}</td>
                <td className={td}>
                  {ds.vendors
                    .filter((v) => v.calendarId === c.id)
                    .map((v) => v.name)
                    .join(', ') || '—'}
                </td>
                <td className={tdNum}>{ds.calendarExceptions.filter((x) => x.calendarId === c.id || x.calendarId === 'ALL').length}</td>
                {canEdit && (
                  <td className={td}>
                    <IconButton icon={Pencil} label={`Edit ${c.name}`} onClick={() => setEdit(c)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      {edit && <CalendarModal ds={ds} cal={edit} onClose={() => setEdit(null)} />}
    </Card>
  )
}

function CalExTab({ ds, canEdit }: { ds: Dataset; canEdit: boolean }) {
  const rows = [...ds.calendarExceptions].sort((a, b) => a.date.localeCompare(b.date))
  const { ask, dialog } = useConfirm()
  return (
    <Card bodyClass="p-0">
      {rows.length === 0 ? (
        <EmptyState title="No calendar exceptions" />
      ) : (
        <TableWrap>
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Applies to</th>
                <th className={th}>Type</th>
                <th className={th}>Reason</th>
                {canEdit && (
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} className="hover:bg-surface-muted/60">
                  <td className={cx(td, 'num whitespace-nowrap')}>
                    {fmtDow(x.date)} {fmtDate(x.date, true)}
                  </td>
                  <td className={td}>{x.calendarId === 'ALL' ? 'All calendars' : (ds.calendars.find((c) => c.id === x.calendarId)?.name ?? x.calendarId)}</td>
                  <td className={td}>
                    <Badge tone={x.type === 'Extra working day' ? 'ok' : 'none'}>{x.type}</Badge>
                  </td>
                  <td className={td}>{x.reason}</td>
                  {canEdit && (
                    <td className={td}>
                      <IconButton
                        icon={Trash2}
                        label={`Remove ${x.reason}`}
                        onClick={() =>
                          ask({
                            title: 'Remove calendar exception?',
                            confirmLabel: 'Remove exception',
                            body: (
                              <p>
                                <span className="font-medium">{x.reason}</span> ({x.type}, {fmtDate(x.date, true)}) will be removed and the weekly pattern applies again on that date. Statuses recalculate immediately.
                              </p>
                            ),
                            onConfirm: () =>
                              saveMaster(
                                (m) => ({
                                  ...m,
                                  calendarExceptions: m.calendarExceptions.filter((c) => c.id !== x.id),
                                }),
                                'Removed calendar exception',
                                `${x.id} · ${x.date} · ${x.reason}`,
                              ),
                          })
                        }
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      {dialog}
    </Card>
  )
}

function CodesTab({ ds, canEdit }: { ds: Dataset; canEdit: boolean }) {
  const [edit, setEdit] = useState<CodeMapping | null>(null)
  const [vendor, setVendor] = useState('')
  const rows = ds.codeMappings.filter((c) => !vendor || c.vendorId === vendor)
  const { ask, dialog } = useConfirm()
  return (
    <div className="space-y-3">
      <LocalFilters>
        <Select label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)}>
          <option value="">All vendors</option>
          {ds.vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </Select>
      </LocalFilters>
      <Card bodyClass="p-0">
        {rows.length === 0 ? (
          <EmptyState title="No mappings for this vendor" />
        ) : (
          <TableWrap>
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={th}>Vendor</th>
                  <th className={th}>Vendor item code</th>
                  <th className={th}>FG code</th>
                  <th className={th}>Note</th>
                  {canEdit && (
                    <th className={th}>
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const s = ds.idx.sku.get(c.skuCode)
                  const related = (ds.idx.vendorSkus.get(c.vendorId) ?? []).includes(c.skuCode)
                  return (
                    <tr key={c.id} className="hover:bg-surface-muted/60">
                      <td className={td}>{ds.idx.vendor.get(c.vendorId)?.name ?? c.vendorId}</td>
                      <td className={cx(td, 'font-mono text-dense')}>{c.vendorCode}</td>
                      <td className={td}>
                        <span className="font-mono text-dense">{c.skuCode}</span> <span className="text-ink-muted">{s?.name ?? 'Unknown SKU'}</span>
                        {!related && (
                          <Badge tone="warn" className="ml-1.5">
                            No vendor relationship
                          </Badge>
                        )}
                      </td>
                      <td className={cx(td, 'text-ink-muted')}>{c.note || '—'}</td>
                      {canEdit && (
                        <td className={cx(td, 'whitespace-nowrap')}>
                          <IconButton icon={Pencil} label={`Edit mapping ${c.vendorCode}`} onClick={() => setEdit(c)} />
                          <IconButton
                            icon={Trash2}
                            label={`Remove mapping ${c.vendorCode}`}
                            onClick={() =>
                              ask({
                                title: 'Remove code mapping?',
                                confirmLabel: 'Remove mapping',
                                body: (
                                  <p>
                                    Vendor code <span className="font-mono">{c.vendorCode}</span> from {ds.idx.vendor.get(c.vendorId)?.name} will no longer map to <span className="font-mono">{c.skuCode}</span>. Rows with this code will be
                                    excluded at upload with an “unmapped code” warning.
                                  </p>
                                ),
                                onConfirm: () =>
                                  saveMaster(
                                    (m) => ({
                                      ...m,
                                      codeMappings: m.codeMappings.filter((x) => x.id !== c.id),
                                    }),
                                    'Removed code mapping',
                                    `${ds.idx.vendor.get(c.vendorId)?.name}: ${c.vendorCode} → ${c.skuCode}`,
                                  ),
                              })
                            }
                          />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      {edit && <CodeMappingModal ds={ds} mapping={edit} onClose={() => setEdit(null)} />}
      {dialog}
    </div>
  )
}

function ParamsTab({ ds, canEdit }: { ds: Dataset; canEdit: boolean }) {
  const [edit, setEdit] = useState<Parameter | null>(null)
  return (
    <Card bodyClass="p-0">
      <TableWrap>
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={th}>Parameter</th>
              <th className={cx(th, 'text-right')}>Value</th>
              <th className={th}>Used for</th>
              <th className={th}>Status</th>
              {canEdit && (
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {ds.parameters.map((p) => (
              <tr key={p.key} className="hover:bg-surface-muted/60">
                <td className={td}>
                  <div className="font-medium">{p.label}</div>
                  <div className="font-mono text-label text-ink-subtle">{p.key}</div>
                </td>
                <td className={tdNum}>
                  {fmtNum(p.value)} <span className="text-ink-muted">{p.unit}</span>
                </td>
                <td className={cx(td, 'text-ink-muted')}>{p.description}</td>
                <td className={td}>
                  {p.assumption ? (
                    <Badge tone="warn" icon={FlaskConical}>
                      Demo assumption
                    </Badge>
                  ) : (
                    <Badge tone="ok">Confirmed</Badge>
                  )}
                </td>
                {canEdit && (
                  <td className={td}>
                    <IconButton icon={Pencil} label={`Edit ${p.label}`} onClick={() => setEdit(p)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      {edit && <ParamModal ds={ds} param={edit} onClose={() => setEdit(null)} />}
    </Card>
  )
}

function HistoryTab() {
  const all = useAppState((s) => s.activity)
  const [q, setQ] = useState('')
  const rows = all.filter((a) => a.area === 'Master data' && (!q || `${a.by} ${a.action} ${a.target} ${a.detail ?? ''}`.toLowerCase().includes(q.toLowerCase())))
  const pg = usePaged(rows)
  return (
    <div className="space-y-3">
      <LocalFilters>
        <SearchBox className="w-[280px]" value={q} onChange={setQ} label="Search change history" placeholder="Search change history…" />
      </LocalFilters>
      <Card bodyClass="p-0">
        {rows.length === 0 ? (
          q ? (
            <EmptyState title="No changes match">Clear the search to see all recorded changes.</EmptyState>
          ) : (
            <EmptyState title="No changes recorded">Changes made in the other sections appear here with who, when and what changed.</EmptyState>
          )
        ) : (
          <>
            <TableWrap>
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className={th}>When</th>
                    <th className={th}>By</th>
                    <th className={th}>Change</th>
                    <th className={th}>Record</th>
                    <th className={th}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  <ActivityRows entries={pg.slice} />
                </tbody>
              </table>
            </TableWrap>
            <Pager page={pg.page} pages={pg.pages} onPage={pg.setPage} total={rows.length} label="changes" />
          </>
        )}
      </Card>
    </div>
  )
}
