// Contents of the vendor SKU drawer on Master Data › Vendors: the selected vendor's SKU relationships.
// Loaded on demand (the drawer shows a loading state meanwhile). Uses the same forms and confirmations as before.
import { Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { VendorSkuMap } from '@/data/types'
import type { Dataset } from '@/data/dataset'
import { Badge, Button, EmptyState, IconButton, cx, td, th } from '@/components/ui'
import { fmtDate } from '@/lib/dates'
import { RelationModal } from './MasterForms'
import { saveMaster, useConfirm } from './shared'

export default function VendorSkuList({ ds, vendorId, canEdit }: { ds: Dataset; vendorId: string; canEdit: boolean }) {
  const [form, setForm] = useState<VendorSkuMap | 'new' | null>(null)
  const { ask, dialog } = useConfirm()
  const v = ds.idx.vendor.get(vendorId)
  const maps = ds.vendorSkuMaps.filter((m) => m.vendorId === vendorId)
  const add = canEdit && (
    <Button size="sm" variant="primary" icon={Plus} onClick={() => setForm('new')}>
      Add SKU
    </Button>
  )
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-dense text-ink-muted">A SKU can be produced by several vendors. Relationships decide which vendor/SKU pairs appear in analysis.</p>
        {maps.length > 0 && add}
      </div>
      {maps.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-line">
          <EmptyState icon={Link2} title="No SKUs mapped" action={add || undefined}>
            {v?.name} has no vendor–SKU relationships, so it does not appear in SKU-level analysis.
          </EmptyState>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-line">
          <table className="w-full border-separate border-spacing-0">
            <caption className="sr-only">SKUs mapped to {v?.name}</caption>
            <thead>
              <tr>
                <th className={th}>SKU</th>
                <th className={th}>Role</th>
                <th className={th}>Since</th>
                <th className={th}>Other vendors</th>
                {canEdit && (
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {maps.map((m) => {
                const s = ds.idx.sku.get(m.skuCode)
                const others = (ds.idx.skuVendors.get(m.skuCode) ?? []).filter((x) => x !== m.vendorId)
                return (
                  <tr key={m.skuCode} className="align-top hover:bg-surface-muted/60">
                    <td className={td}>
                      <div className="text-ink">{s?.name ?? <span className="text-bad">Unknown SKU</span>}</div>
                      <div className="font-mono text-label text-ink-subtle">{m.skuCode}</div>
                    </td>
                    <td className={td}>
                      <Badge tone={m.primary ? 'accent' : 'none'}>{m.primary ? 'Primary' : 'Secondary'}</Badge>
                    </td>
                    <td className={cx(td, 'num whitespace-nowrap')}>{fmtDate(m.since, true)}</td>
                    <td className={cx(td, 'text-ink-muted')}>{others.map((o) => ds.idx.vendor.get(o)?.name ?? o).join(', ') || '—'}</td>
                    {canEdit && (
                      <td className={cx(td, 'whitespace-nowrap')}>
                        <IconButton icon={Pencil} label={`Edit relationship ${v?.name} → ${m.skuCode}`} onClick={() => setForm(m)} />
                        <IconButton
                          icon={Trash2}
                          label={`Remove relationship ${v?.name} → ${m.skuCode}`}
                          onClick={() =>
                            ask({
                              title: 'Remove vendor–SKU relationship?',
                              confirmLabel: 'Remove relationship',
                              body: (
                                <p>
                                  <span className="font-medium">{v?.name}</span> will no longer be linked to <span className="font-medium">{s?.name ?? m.skuCode}</span> ({m.skuCode}). The pair drops out of analysis
                                  {ds.codeMappings.some((c) => c.vendorId === m.vendorId && c.skuCode === m.skuCode) ? ' and its code mappings will show “No vendor relationship”' : ''}.
                                </p>
                              ),
                              onConfirm: () =>
                                saveMaster(
                                  (mt) => ({
                                    ...mt,
                                    vendorSkuMaps: mt.vendorSkuMaps.filter((x) => !(x.vendorId === m.vendorId && x.skuCode === m.skuCode)),
                                  }),
                                  'Removed vendor–SKU relationship',
                                  `${v?.name} → ${m.skuCode}`,
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
        </div>
      )}
      {form && <RelationModal ds={ds} vendorId={vendorId} map={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
      {dialog}
    </div>
  )
}
