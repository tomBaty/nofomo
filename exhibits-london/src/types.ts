export interface Exhibition {
    id?: number
    venue: string
    category: string
    paid: string
    url: string
    dates: string[]
    dateRangeType: string
    description: string
    shortDescription: string
    priceInfo: string
    icon: string
}
export interface FilterState {
    venues: string[]
    categories: string[]
    paid: string[]
}